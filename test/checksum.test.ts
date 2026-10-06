import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { digestsEqual, parseChecksumFile, sha256File } from "../src/checksum.js";

const DIGEST = "a".repeat(64);

test("parses sha256sum output with and without the file name", () => {
  assert.equal(parseChecksumFile(`${DIGEST}\n`), DIGEST);
  assert.equal(parseChecksumFile(`${DIGEST}  archive.tar.gz\n`), DIGEST);
  assert.equal(parseChecksumFile(`${DIGEST} *archive.tar.gz\n`), DIGEST);
  assert.equal(parseChecksumFile(`\n${DIGEST}  archive.tar.gz\n\n`), DIGEST);
});

test("normalizes uppercase digests from other tooling", () => {
  assert.equal(parseChecksumFile("A".repeat(64)), DIGEST);
});

test("rejects a checksum file naming a different archive", () => {
  assert.throws(
    () => parseChecksumFile(`${DIGEST}  other.tar.gz`, "archive.tar.gz"),
    /records "other.tar.gz" but the archive is "archive.tar.gz"/,
  );
});

test("rejects malformed or empty checksum files", () => {
  assert.throws(() => parseChecksumFile(""), /empty/);
  assert.throws(() => parseChecksumFile("\n  \n"), /empty/);
  assert.throws(() => parseChecksumFile("not-a-digest"), /malformed checksum line/);
  assert.throws(() => parseChecksumFile("abc123"), /malformed checksum line/);
});

test("hashes a real file against known-answer vectors", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "checksum-test-"));

  const empty = path.join(dir, "empty");
  await writeFile(empty, "");
  assert.equal(
    await sha256File(empty),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );

  const payload = path.join(dir, "payload");
  await writeFile(payload, "abc");
  const actual = await sha256File(payload);
  assert.equal(actual, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(digestsEqual(actual, actual), true);
  assert.equal(digestsEqual(actual, "0".repeat(64)), false);

  // Malformed inputs never compare equal.
  assert.equal(digestsEqual("short", actual), false);
  assert.equal(digestsEqual(actual, "not-hex".padEnd(64, "z")), false);
});
