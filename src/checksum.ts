import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";

/** A SHA-256 digest as lowercase hex. */
export type Sha256 = string;

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Parse a `sha256sum`-style checksum file.
 *
 * Accepts `<hex>`, `<hex>  <file>`, or `<hex> *<file>`. When `expectedFile` is
 * given, the recorded file name must match exactly, so a mismatch between the
 * archive and its checksum file is a hard error rather than a silent pass.
 *
 * @throws if the file is empty, the digest is not 64 lowercase hex chars, or
 *   the recorded file name disagrees with `expectedFile`.
 */
export function parseChecksumFile(contents: string, expectedFile?: string): Sha256 {
  const line = contents
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (line === undefined) {
    throw new Error("checksum file is empty");
  }

  const match = /^([0-9a-fA-F]{64})(?:\s+\*?(.+))?$/.exec(line);
  if (match === null) {
    throw new Error(`malformed checksum line: ${JSON.stringify(line)}`);
  }

  const digest = match[1]!.toLowerCase();
  const recorded = match[2];
  if (recorded !== undefined && expectedFile !== undefined && recorded !== expectedFile) {
    throw new Error(
      `checksum file records ${JSON.stringify(recorded)} but the archive is ${JSON.stringify(expectedFile)}`,
    );
  }
  return digest;
}

/** Compute the SHA-256 of a file, streaming so large archives never load into memory. */
export async function sha256File(path: string): Promise<Sha256> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve());
  });
  return hash.digest("hex");
}

/** Compare two digests without leaking their contents through timing. */
export function digestsEqual(a: string, b: string): boolean {
  if (!HEX64.test(a) || !HEX64.test(b)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
