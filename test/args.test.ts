import assert from "node:assert/strict";
import test from "node:test";

import { checkArgs } from "../src/args.js";

test("builds the minimal check invocation", () => {
  assert.deepEqual(
    checkArgs({ path: ".", format: "json", failOn: "error", experimental: false }),
    ["check", ".", "--format", "json", "--fail-on", "error"],
  );
});

test("adds --experimental and --config only when requested", () => {
  assert.deepEqual(
    checkArgs({
      path: "contracts",
      format: "sarif",
      failOn: "warning",
      experimental: true,
      config: "ci/soroban-lint.toml",
    }),
    [
      "check",
      "contracts",
      "--format",
      "sarif",
      "--fail-on",
      "warning",
      "--experimental",
      "--config",
      "ci/soroban-lint.toml",
    ],
  );
  assert.equal(
    checkArgs({ path: ".", format: "json", failOn: "never", experimental: false }).includes(
      "--config",
    ),
    false,
  );
});

test("an empty config input is not passed through as a flag", () => {
  assert.equal(
    checkArgs({ path: ".", format: "json", failOn: "info", experimental: false, config: "" }).includes(
      "--config",
    ),
    false,
  );
});

test("a path is one argument, so spaces and dashes cannot become options", () => {
  const args = checkArgs({
    path: "--weird path/with spaces",
    format: "json",
    failOn: "error",
    experimental: false,
  });
  assert.equal(args[1], "--weird path/with spaces");
  assert.equal(args.filter((a) => a === "check").length, 1);
});
