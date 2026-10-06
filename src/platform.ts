/**
 * Maps a runner's OS/architecture onto the Rust target triple used by the
 * `soroban-lint-core` release assets. This must stay in sync with the release
 * workflow's build matrix.
 */

/** The release asset file extension for a target. */
export type ArchiveExtension = "tar.gz" | "zip";

/** Rust target triples published with each release. */
export const SUPPORTED_TARGETS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
] as const;

export type SupportedTarget = (typeof SUPPORTED_TARGETS)[number];

/**
 * Resolve the Rust target triple for a runner.
 *
 * @throws if the platform/architecture combination has no published binary.
 */
export function rustTarget(platform: string, arch: string): SupportedTarget {
  const key = `${platform}/${arch}`;
  switch (key) {
    case "linux/x64":
      return "x86_64-unknown-linux-gnu";
    case "linux/arm64":
      return "aarch64-unknown-linux-gnu";
    case "darwin/x64":
      return "x86_64-apple-darwin";
    case "darwin/arm64":
      return "aarch64-apple-darwin";
    case "win32/x64":
      return "x86_64-pc-windows-msvc";
    default:
      throw new Error(
        `soroban-lint has no prebuilt binary for ${key}. ` +
          `Supported: ${SUPPORTED_TARGETS.join(", ")}.`,
      );
  }
}

/** The archive extension for a target. */
export function archiveExtension(target: string): ArchiveExtension {
  return target.includes("windows") ? "zip" : "tar.gz";
}

/** The executable name inside the archive for a target. */
export function binaryName(target: string): string {
  return target.includes("windows") ? "soroban-lint.exe" : "soroban-lint";
}

/** The release asset file name for a tag and target, e.g. `soroban-lint-v0.1.0-x86_64-unknown-linux-gnu.tar.gz`. */
export function assetName(tag: string, target: string): string {
  return `soroban-lint-${tag}-${target}.${archiveExtension(target)}`;
}
