import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORTED_TARGETS,
  archiveExtension,
  assetName,
  binaryName,
  rustTarget,
} from "../src/platform.js";

test("maps every runner platform to a published target", () => {
  const cases: Array<[string, string, string]> = [
    ["linux", "x64", "x86_64-unknown-linux-gnu"],
    ["linux", "arm64", "aarch64-unknown-linux-gnu"],
    ["darwin", "x64", "x86_64-apple-darwin"],
    ["darwin", "arm64", "aarch64-apple-darwin"],
    ["win32", "x64", "x86_64-pc-windows-msvc"],
  ];
  for (const [platform, arch, expected] of cases) {
    assert.equal(rustTarget(platform, arch), expected, `${platform}/${arch}`);
    assert.ok(
      (SUPPORTED_TARGETS as readonly string[]).includes(expected),
      `${expected} must be part of the release matrix`,
    );
  }
});

test("rejects platforms without a prebuilt binary", () => {
  assert.throws(() => rustTarget("linux", "ia32"), /no prebuilt binary for linux\/ia32/);
  assert.throws(() => rustTarget("win32", "arm64"), /no prebuilt binary/);
  assert.throws(() => rustTarget("freebsd", "x64"), /no prebuilt binary/);
});

test("windows uses a zip and an .exe", () => {
  assert.equal(archiveExtension("x86_64-pc-windows-msvc"), "zip");
  assert.equal(binaryName("x86_64-pc-windows-msvc"), "soroban-lint.exe");
  assert.equal(archiveExtension("x86_64-unknown-linux-gnu"), "tar.gz");
  assert.equal(binaryName("aarch64-apple-darwin"), "soroban-lint");
});

test("asset names match what the release workflow uploads", () => {
  assert.equal(
    assetName("v0.1.0", "x86_64-unknown-linux-gnu"),
    "soroban-lint-v0.1.0-x86_64-unknown-linux-gnu.tar.gz",
  );
  assert.equal(
    assetName("v0.1.0", "x86_64-pc-windows-msvc"),
    "soroban-lint-v0.1.0-x86_64-pc-windows-msvc.zip",
  );
});
