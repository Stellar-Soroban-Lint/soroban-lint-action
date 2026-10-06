import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * The scope statement is required verbatim wherever this action is described —
 * the Marketplace reads `action.yml`, users read `README.md`. Pinning the exact
 * wording here means a reworded description fails CI instead of shipping.
 */
const STATEMENT =
  "soroban-lint performs syntactic, per-file analysis of Soroban contract source using the Rust AST. It flags patterns associated with missing authorization checks, panic paths, unchecked arithmetic, and storage hazards in `#[contractimpl]` functions. It does not expand macros, resolve types, or follow calls across files, so it can miss real issues (false negatives) and flag safe code (false positives). A clean report is not evidence a contract is secure, and this tool is not a substitute for an audit.";

// The tests are compiled to `build/test/`, so resolve surfaces against the
// package root that `npm test` runs from rather than against the test file.
function read(name: string): string {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

test("the expected statement is well formed", () => {
  assert.ok(STATEMENT.startsWith("soroban-lint performs syntactic, per-file analysis"));
  assert.ok(STATEMENT.endsWith("this tool is not a substitute for an audit."));
  assert.ok(!STATEMENT.includes("\n"), "the statement must be a single line");
  assert.ok(!STATEMENT.includes("  "), "the statement must not contain double spaces");
});

for (const surface of ["README.md", "action.yml"]) {
  test(`${surface} carries the scope statement verbatim`, () => {
    assert.ok(
      read(surface).includes(STATEMENT),
      `${surface} must carry the scope statement verbatim`,
    );
  });
}
