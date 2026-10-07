import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMENT_MARKER,
  isOurComment,
  publishComment,
  pullRequestFromEvent,
  renderCommentBody,
  type FetchLike,
} from "../src/comment.js";
import type { Diagnostic, SeverityCounts } from "../src/diagnostics.js";

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    rule_id: "SL002",
    severity: "warning",
    confidence: "high",
    message: "`unwrap` can panic in a contract function",
    file: "contracts/token/src/lib.rs",
    start_line: 40,
    start_column: 9,
    end_line: 40,
    end_column: 20,
    help: "return `Result<_, ContractError>`",
    fix: null,
    ...overrides,
  };
}

const COUNTS: SeverityCounts = { total: 1, errors: 0, warnings: 1, notices: 0 };

test("the comment body leads with the hidden marker so it can be found later", () => {
  const body = renderCommentBody([diagnostic()], COUNTS, { tag: "v0.1.0", failOn: "error" });
  assert.ok(body.startsWith(COMMENT_MARKER));
  assert.ok(body.includes("v0.1.0"));
  assert.ok(body.includes("1 finding(s)"));
  assert.ok(body.includes("SL002"));
  assert.ok(body.includes("contracts/token/src/lib.rs:40:9"));
  // The limitation travels with the capability claim, never as a footnote.
  assert.ok(body.includes("not a substitute for an audit"));
});

test("a clean run says so without claiming security", () => {
  const body = renderCommentBody([], { total: 0, errors: 0, warnings: 0, notices: 0 }, {
    tag: "v0.1.0",
    failOn: "error",
  });
  assert.ok(body.includes("No findings."));
  assert.ok(body.includes("not evidence the contract is secure"));
});

test("a long finding list is capped and says how many were omitted", () => {
  const many = Array.from({ length: 25 }, (_, index) =>
    diagnostic({ message: `finding ${index}`, start_line: index + 1 }),
  );
  const body = renderCommentBody(many, { total: 25, errors: 0, warnings: 25, notices: 0 }, {
    tag: "v0.1.0",
    failOn: "warning",
  });
  assert.ok(body.includes("5 further finding(s) not listed"));
  // 20 rows plus the header rows.
  assert.equal(body.split("\n").filter((line) => line.startsWith("| SL002")).length, 20);
});

test("table cells cannot break out of the table", () => {
  const body = renderCommentBody(
    [diagnostic({ message: "pipe | and\nnewline" })],
    COUNTS,
    { tag: "v0.1.0", failOn: "error" },
  );
  assert.ok(body.includes("pipe \\| and newline"));
  assert.ok(!body.includes("| pipe | and"));
});

test("a body is recognised as ours only by the marker", () => {
  assert.equal(isOurComment(`${COMMENT_MARKER}\n### soroban-lint`), true);
  assert.equal(isOurComment(`\n  ${COMMENT_MARKER}`), true);
  assert.equal(isOurComment("### soroban-lint\nlooks similar"), false);
  assert.equal(isOurComment("<!-- some other bot -->"), false);
});

test("only pull request events yield a context", () => {
  const pr = {
    number: 7,
    pull_request: { head: { repo: { fork: false } } },
    repository: { full_name: "Stellar-Soroban-Lint/demo" },
  };
  assert.deepEqual(pullRequestFromEvent(pr), {
    owner: "Stellar-Soroban-Lint",
    repository: "demo",
    number: 7,
  });
  assert.equal(pullRequestFromEvent({ ref: "refs/heads/main" }), null);
  assert.equal(pullRequestFromEvent(null), null);
  // A payload without `repository.full_name` falls back to the environment.
  assert.deepEqual(
    pullRequestFromEvent({ number: 3, pull_request: {} }, "o/r"),
    { owner: "o", repository: "r", number: 3 },
  );
  assert.equal(pullRequestFromEvent({ number: 0, pull_request: {} }), null);
});

/** A stub fetch that records calls and replies from a queue. */
function stubFetch(replies: { status: number; body?: unknown }[]): {
  fetchImpl: FetchLike;
  calls: { url: string; method: string }[];
} {
  const calls: { url: string; method: string }[] = [];
  const queue = [...replies];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const reply = queue.shift() ?? { status: 200, body: [] };
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      statusText: String(reply.status),
      json: async () => reply.body ?? {},
    };
  };
  return { fetchImpl, calls };
}

const CONTEXT = { owner: "o", repository: "r", number: 5 } as const;

test("creates a comment when none of ours exists", async () => {
  const { fetchImpl, calls } = stubFetch([{ status: 200, body: [] }, { status: 201 }]);
  const outcome = await publishComment({ context: CONTEXT, token: "t", body: "hello", fetchImpl });
  assert.equal(outcome, "created");
  assert.equal(calls[0]!.method, "GET");
  assert.equal(calls[1]!.method, "POST");
  assert.ok(calls[1]!.url.endsWith("/issues/5/comments"));
});

test("updates the existing comment in place instead of adding another", async () => {
  const { fetchImpl, calls } = stubFetch([
    { status: 200, body: [{ id: 99, body: `${COMMENT_MARKER}\nold` }] },
    { status: 200 },
  ]);
  const outcome = await publishComment({ context: CONTEXT, token: "t", body: "new", fetchImpl });
  assert.equal(outcome, "updated");
  assert.equal(calls[1]!.method, "PATCH");
  assert.ok(calls[1]!.url.endsWith("/issues/comments/99"));
});

test("a read-only token surfaces as an error the caller can downgrade", async () => {
  const { fetchImpl } = stubFetch([{ status: 403 }]);
  await assert.rejects(
    () => publishComment({ context: CONTEXT, token: "t", body: "x", fetchImpl }),
    /listing comments failed: 403/,
  );
});

test("a rejected create also throws", async () => {
  const { fetchImpl } = stubFetch([{ status: 200, body: [] }, { status: 422 }]);
  await assert.rejects(
    () => publishComment({ context: CONTEXT, token: "t", body: "x", fetchImpl }),
    /creating the comment failed: 422/,
  );
});
