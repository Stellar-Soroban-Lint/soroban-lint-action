import assert from "node:assert/strict";
import test from "node:test";

import {
  annotationLevel,
  limitAnnotations,
  parseDiagnostics,
  summarize,
  toAnnotation,
  type Diagnostic,
} from "../src/diagnostics.js";

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    rule_id: "SL001",
    severity: "error",
    confidence: "medium",
    message: "`set_balance` mutates state without an authorization check",
    file: "contracts/token/src/lib.rs",
    start_line: 12,
    start_column: 5,
    end_line: 12,
    end_column: 18,
    help: "call `require_auth()` before the first mutation",
    fix: "addr.require_auth()",
    ...overrides,
  };
}

test("parses the CLI document and tolerates trailing whitespace", () => {
  const doc = { version: "1", diagnostics: [diagnostic()] };
  const parsed = parseDiagnostics(`${JSON.stringify(doc)}\n`);
  assert.equal(parsed.version, "1");
  assert.equal(parsed.diagnostics.length, 1);
  assert.equal(parsed.diagnostics[0]!.rule_id, "SL001");
});

test("parses an empty finding list", () => {
  const parsed = parseDiagnostics('{"version":"1","diagnostics":[]}');
  assert.deepEqual(parsed.diagnostics, []);
});

test("refuses to treat unparseable output as a clean run", () => {
  assert.throws(() => parseDiagnostics(""), /no JSON on stdout/);
  assert.throws(() => parseDiagnostics("   \n"), /no JSON on stdout/);
  assert.throws(() => parseDiagnostics("not json"), /not JSON/);
  assert.throws(() => parseDiagnostics("[]"), /missing the "version"/);
  assert.throws(() => parseDiagnostics('{"version":"1"}'), /missing the "version"/);
});

test("maps severities onto annotation levels", () => {
  assert.equal(annotationLevel("error"), "error");
  assert.equal(annotationLevel("warning"), "warning");
  assert.equal(annotationLevel("info"), "notice");
});

test("summarizes counts by severity", () => {
  const counts = summarize([
    diagnostic({ severity: "error" }),
    diagnostic({ severity: "warning" }),
    diagnostic({ severity: "warning" }),
    diagnostic({ severity: "info" }),
  ]);
  assert.deepEqual(counts, { errors: 1, warnings: 2, notices: 1, total: 4 });
  assert.deepEqual(summarize([]), { errors: 0, warnings: 0, notices: 0, total: 0 });
});

test("annotations carry file, position, title, and help", () => {
  const annotation = toAnnotation(diagnostic());
  assert.equal(annotation.level, "error");
  assert.equal(annotation.title, "SL001 error");
  assert.equal(annotation.file, "contracts/token/src/lib.rs");
  assert.equal(annotation.startLine, 12);
  assert.equal(annotation.startColumn, 5);
  assert.match(annotation.message, /mutates state/);
  assert.match(annotation.message, /medium confidence/);
  assert.match(annotation.message, /Help: call `require_auth\(\)`/);
});

test("annotations omit the help block when there is none", () => {
  const annotation = toAnnotation(diagnostic({ help: null }));
  assert.doesNotMatch(annotation.message, /Help:/);
});

test("annotation limiting reports how many were dropped", () => {
  const annotations = [1, 2, 3, 4, 5].map((n) => toAnnotation(diagnostic({ message: `m${n}` })));
  assert.deepEqual(limitAnnotations(annotations, 10).emitted.length, 5);
  assert.deepEqual(limitAnnotations(annotations, 10).dropped, 0);

  const limited = limitAnnotations(annotations, 2);
  assert.equal(limited.emitted.length, 2);
  assert.equal(limited.dropped, 3);
  assert.equal(limited.emitted[0]!.message.startsWith("m1"), true);

  // Zero is a valid cap (annotations disabled at call site), negative is "unlimited".
  assert.equal(limitAnnotations(annotations, 0).emitted.length, 0);
  assert.equal(limitAnnotations(annotations, -1).emitted.length, 5);
});
