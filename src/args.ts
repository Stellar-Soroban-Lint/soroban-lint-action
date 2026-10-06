/** The `check` subcommand's options, as exposed by the action. */
export interface CheckOptions {
  /** File or directory to lint. */
  path: string;
  /** Output format; the action uses `json` for annotations and `sarif` for reports. */
  format: "text" | "json" | "sarif";
  /** Minimum severity that causes a non-zero exit. */
  failOn: "error" | "warning" | "info" | "never";
  /** Enable experimental rules. */
  experimental: boolean;
  /** Explicit config path, if any. */
  config?: string;
}

/**
 * Build the argument vector for `soroban-lint check`.
 *
 * The action passes structured flags rather than shell strings, so a path with
 * spaces or a leading dash cannot be reinterpreted as an option.
 */
export function checkArgs(options: CheckOptions): string[] {
  const args = ["check", options.path, "--format", options.format, "--fail-on", options.failOn];
  if (options.experimental) {
    args.push("--experimental");
  }
  if (options.config !== undefined && options.config !== "") {
    args.push("--config", options.config);
  }
  return args;
}
