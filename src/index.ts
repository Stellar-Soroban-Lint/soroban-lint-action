/**
 * soroban-lint-action entrypoint.
 *
 * Downloads the prebuilt `soroban-lint` CLI for the runner platform from a
 * `soroban-lint-core` release, verifies its SHA-256 against the checksum
 * published beside it, then runs the linter and turns the JSON findings into
 * workflow annotations.
 */

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkArgs } from "./args.js";
import { digestsEqual, parseChecksumFile, sha256File } from "./checksum.js";
import {
  limitAnnotations,
  parseDiagnostics,
  summarize,
  toAnnotation,
  type Diagnostic,
} from "./diagnostics.js";
import { assetName, binaryName, rustTarget } from "./platform.js";
import { assetUrls, resolveLatestTag } from "./release.js";

const DEFAULT_REPOSITORY = "Stellar-Soroban-Lint/soroban-lint-core";
const FAIL_ON = ["error", "warning", "info", "never"] as const;
type FailOn = (typeof FAIL_ON)[number];

/** Read an input, returning `fallback` when it is unset or empty. */
function input(name: string, fallback = ""): string {
  const value = core.getInput(name);
  return value === "" ? fallback : value;
}

/** Recursively find the CLI executable inside an extracted release archive. */
async function findBinary(root: string, name: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findBinary(full, name);
      if (nested !== "") {
        return nested;
      }
    } else if (entry.name === name) {
      return full;
    }
  }
  return "";
}

/** Download and verify the release archive, returning the extracted directory. */
async function installCli(
  repository: string,
  tag: string,
  token: string,
  pinnedChecksum: string,
): Promise<string> {
  const target = rustTarget(process.platform, process.arch);
  const asset = assetName(tag, target);
  const urls = assetUrls(repository, tag, asset);
  core.info(`Installing soroban-lint ${tag} (${target})`);

  const workdir = await mkdtemp(path.join(tmpdir(), "soroban-lint-"));
  const archive = await tc.downloadTool(urls.archive, path.join(workdir, asset), token);
  const checksumPath = await tc.downloadTool(
    urls.checksum,
    path.join(workdir, `${asset}.sha256`),
    token,
  );

  const expected = parseChecksumFile(await readFile(checksumPath, "utf8"), asset);
  const actual = await sha256File(archive);
  if (!digestsEqual(actual, expected)) {
    throw new Error(
      `checksum mismatch for ${asset}: the release publishes ${expected} but the downloaded archive hashes to ${actual}`,
    );
  }
  if (pinnedChecksum !== "" && !digestsEqual(actual, pinnedChecksum.toLowerCase())) {
    throw new Error(
      `archive checksum ${actual} does not match the pinned "checksum" input ${pinnedChecksum.toLowerCase()}`,
    );
  }
  core.info(`Verified SHA-256 ${actual}`);

  const extracted = archive.endsWith(".zip")
    ? await tc.extractZip(archive)
    : await tc.extractTar(archive);

  const binary = await findBinary(extracted, binaryName(target));
  if (binary === "") {
    throw new Error(`could not find ${binaryName(target)} inside ${asset}`);
  }
  if (process.platform !== "win32") {
    await chmod(binary, 0o755);
  }
  return binary;
}

/** Emit one annotation per finding, respecting the cap. */
function annotate(diagnostics: readonly Diagnostic[], max: number): void {
  const { emitted, dropped } = limitAnnotations(diagnostics.map(toAnnotation), max);
  for (const annotation of emitted) {
    const properties = {
      title: annotation.title,
      file: annotation.file,
      startLine: annotation.startLine,
      startColumn: annotation.startColumn,
      endLine: annotation.endLine,
      endColumn: annotation.endColumn,
    };
    switch (annotation.level) {
      case "error":
        core.error(annotation.message, properties);
        break;
      case "warning":
        core.warning(annotation.message, properties);
        break;
      case "notice":
        core.notice(annotation.message, properties);
        break;
    }
  }
  if (dropped > 0) {
    core.info(`Annotation cap reached: ${dropped} further finding(s) were not annotated.`);
  }
}

async function run(): Promise<void> {
  const requestedVersion = input("version", "latest");
  const repository = input("repository", DEFAULT_REPOSITORY);
  const targetPath = input("path", ".");
  const failOn = input("fail-on", "error") as FailOn;
  const experimental = core.getBooleanInput("experimental");
  const annotations = core.getBooleanInput("annotations");
  const maxAnnotations = Number.parseInt(input("max-annotations", "50"), 10);
  const config = input("config");
  const extraArgs = input("args");
  const pinnedChecksum = input("checksum");
  const token = input("token", process.env.GITHUB_TOKEN ?? "");
  const sarifFile = input("sarif-file");

  if (!FAIL_ON.includes(failOn)) {
    throw new Error(`invalid "fail-on" input ${JSON.stringify(failOn)}; expected one of ${FAIL_ON.join(", ")}`);
  }
  if (!Number.isInteger(maxAnnotations) || maxAnnotations < 0) {
    throw new Error(`invalid "max-annotations" input; expected a non-negative integer`);
  }

  const tag =
    requestedVersion === "latest" ? await resolveLatestTag(repository, token) : requestedVersion;
  core.setOutput("version", tag);

  const binary = await installCli(repository, tag, token, pinnedChecksum);
  core.addPath(path.dirname(binary));
  core.setOutput("binary", binary);

  const shared = { path: targetPath, failOn, experimental, config } as const;

  const jsonArgs = [...checkArgs({ ...shared, format: "json" }), ...splitArgs(extraArgs)];
  core.info(`Running: soroban-lint ${jsonArgs.join(" ")}`);
  const result = await exec.getExecOutput(binary, jsonArgs, { ignoreReturnCode: true });

  if (result.stderr.trim() !== "") {
    core.info(result.stderr.trim());
  }

  let diagnostics: Diagnostic[] = [];
  if (result.exitCode !== 2) {
    diagnostics = parseDiagnostics(result.stdout).diagnostics;
  }

  const counts = summarize(diagnostics);
  core.setOutput("findings", counts.total);
  core.setOutput("errors", counts.errors);
  core.setOutput("warnings", counts.warnings);
  core.setOutput("notices", counts.notices);
  core.setOutput("exit-code", result.exitCode);

  if (annotations) {
    annotate(diagnostics, maxAnnotations);
  }

  if (sarifFile !== "") {
    const sarifArgs = [...checkArgs({ ...shared, format: "sarif", failOn: "never" }), ...splitArgs(extraArgs)];
    const sarif = await exec.getExecOutput(binary, sarifArgs, { ignoreReturnCode: true });
    await writeFile(sarifFile, sarif.stdout, "utf8");
    core.setOutput("sarif-file", sarifFile);
    core.info(`Wrote SARIF to ${sarifFile}`);
  }

  await core.summary
    .addHeading("soroban-lint", 3)
    .addRaw(
      `${counts.total} finding(s): ${counts.errors} error(s), ${counts.warnings} warning(s), ${counts.notices} notice(s)`,
    )
    .addRaw(
      "\n\nSyntactic, per-file analysis only. Not a security guarantee and not a substitute for an audit.",
    )
    .write();

  if (result.exitCode === 2) {
    throw new Error(
      `soroban-lint exited with 2 (usage or internal error): ${result.stderr.trim() || "no diagnostics emitted"}`,
    );
  }
  if (result.exitCode === 1) {
    throw new Error(
      `${counts.total} finding(s) at or above the "${failOn}" fail-on threshold`,
    );
  }
}

/** Split a free-form extra-arguments string on whitespace. */
function splitArgs(raw: string): string[] {
  return raw.split(/\s+/).filter((part) => part.length > 0);
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error : String(error));
});
