/**
 * The pull request summary comment.
 *
 * GitHub caps annotations (a handful per step and per job), so a repository with
 * many findings would otherwise be silently truncated. The action therefore also
 * posts one comment summarising the run and updates it in place on every push,
 * identified by a hidden marker rather than by "find a comment that looks like
 * ours" — a new comment per push is noise, and guessing wrong is worse.
 *
 * Fork pull requests get a read-only `GITHUB_TOKEN`, so the API call fails. That
 * is expected and handled by the caller, which warns instead of failing: the
 * annotations and the job summary still reach the reader.
 */

import type { Diagnostic, SeverityCounts } from "./diagnostics.js";

/** Hidden marker that identifies the comment this action owns. */
export const COMMENT_MARKER = "<!-- soroban-lint -->";

/** Findings listed in the comment before it defers to the annotations/SARIF. */
const MAX_RENDERED = 20;

/** Escape a value so it cannot break out of a Markdown table cell. */
function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

/** Render the comment body for a run. */
export function renderCommentBody(
  diagnostics: readonly Diagnostic[],
  counts: SeverityCounts,
  options: { tag: string; failOn: string },
): string {
  const lines = [
    COMMENT_MARKER,
    `### soroban-lint \`${options.tag}\``,
    "",
    `**${counts.total} finding(s)**: ${counts.errors} error(s), ${counts.warnings} warning(s), ` +
      `${counts.notices} notice(s). \`fail-on: ${options.failOn}\`.`,
    "",
  ];

  if (counts.total === 0) {
    lines.push(
      "No findings. A clean report is not evidence the contract is secure — this is a syntactic, " +
        "per-file check, not an audit.",
    );
    return lines.join("\n");
  }

  lines.push("| Rule | Severity | Location | Message |", "| --- | --- | --- | --- |");
  for (const diagnostic of diagnostics.slice(0, MAX_RENDERED)) {
    lines.push(
      `| ${cell(diagnostic.rule_id)} | ${cell(diagnostic.severity)} | ` +
        `\`${cell(diagnostic.file)}:${diagnostic.start_line}:${diagnostic.start_column}\` | ` +
        `${cell(diagnostic.message)} |`,
    );
  }
  if (diagnostics.length > MAX_RENDERED) {
    lines.push("", `_${diagnostics.length - MAX_RENDERED} further finding(s) not listed; see the annotations and SARIF._`);
  }
  lines.push(
    "",
    "Syntactic, per-file analysis only. Not a security guarantee and not a substitute for an audit.",
  );
  return lines.join("\n");
}

/** True when a comment body was written by a previous run of this action. */
export function isOurComment(body: string): boolean {
  return body.trimStart().startsWith(COMMENT_MARKER);
}

/** The pull request a workflow run belongs to, if any. */
export interface PullRequestContext {
  owner: string;
  repository: string;
  number: number;
}

/**
 * Extract the pull request context from a workflow event payload.
 *
 * Returns `null` for pushes, tags, and schedules — the action only comments on a
 * pull request. `repository` may be supplied separately (`GITHUB_REPOSITORY`)
 * because a few event payloads omit `full_name`.
 */
export function pullRequestFromEvent(
  event: unknown,
  repositoryFullName?: string,
): PullRequestContext | null {
  if (typeof event !== "object" || event === null) {
    return null;
  }
  const record = event as Record<string, unknown>;
  const number = record["number"];
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return null;
  }
  if (typeof record["pull_request"] !== "object" || record["pull_request"] === null) {
    return null;
  }
  const fromEvent = (record["repository"] as { full_name?: unknown } | undefined)?.full_name;
  const fullName = typeof fromEvent === "string" ? fromEvent : repositoryFullName;
  if (typeof fullName !== "string" || !fullName.includes("/")) {
    return null;
  }
  const [owner, repository] = fullName.split("/");
  if (owner === undefined || repository === undefined) {
    return null;
  }
  return { owner, repository, number };
}

/** A minimal `fetch` shape, so the network call can be tested with a stub. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

interface Comment {
  id: number;
  body: string;
}

/**
 * Create or update the action's comment on a pull request.
 *
 * Returns which happened. Throws on any non-OK response (including the 403 a
 * fork pull request's read-only token produces), leaving the caller to decide
 * whether that is fatal.
 */
export async function publishComment(options: {
  context: PullRequestContext;
  token: string;
  body: string;
  apiBase?: string;
  fetchImpl?: FetchLike;
}): Promise<"created" | "updated"> {
  const { context, token, body } = options;
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const apiBase = options.apiBase ?? "https://api.github.com";
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };
  const base = `${apiBase}/repos/${context.owner}/${context.repository}/issues/${context.number}/comments`;

  const listed = await fetchImpl(`${base}?per_page=100`, { headers });
  if (!listed.ok) {
    throw new Error(`listing comments failed: ${listed.status} ${listed.statusText}`);
  }
  const existing = (await listed.json()) as unknown;
  const ours = Array.isArray(existing)
    ? (existing as Comment[]).find((comment) => isOurComment(comment.body))
    : undefined;

  if (ours !== undefined) {
    const updated = await fetchImpl(`${apiBase}/repos/${context.owner}/${context.repository}/issues/comments/${ours.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body }),
    });
    if (!updated.ok) {
      throw new Error(`updating the comment failed: ${updated.status} ${updated.statusText}`);
    }
    return "updated";
  }

  const created = await fetchImpl(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  if (!created.ok) {
    throw new Error(`creating the comment failed: ${created.status} ${created.statusText}`);
  }
  return "created";
}
