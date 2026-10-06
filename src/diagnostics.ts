/**
 * The `soroban-lint check --format json` contract.
 *
 * The envelope is `{ "version": "1", "diagnostics": [...] }`; the field names
 * below are the public JSON contract of `soroban-lint-core`.
 */

export type Severity = "info" | "warning" | "error";

export interface Diagnostic {
  rule_id: string;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  message: string;
  file: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  help: string | null;
  fix: string | null;
}

export interface DiagnosticDocument {
  version: string;
  diagnostics: Diagnostic[];
}

export type AnnotationLevel = "error" | "warning" | "notice";

/** Map a diagnostic severity onto a workflow-command annotation level. */
export function annotationLevel(severity: Severity): AnnotationLevel {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "notice";
  }
}

/**
 * Parse the CLI's JSON document.
 *
 * Trailing whitespace from the CLI's `println!` is tolerated. Anything that is
 * not a well-formed document with a `diagnostics` array is rejected loudly,
 * because silently reporting "no findings" on unparseable output would be worse
 * than failing.
 */
export function parseDiagnostics(stdout: string): DiagnosticDocument {
  const text = stdout.trim();
  if (text.length === 0) {
    throw new Error("soroban-lint produced no JSON on stdout");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `soroban-lint produced output that is not JSON: ${(error as Error).message}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("soroban-lint JSON output is not an object");
  }
  const doc = parsed as Partial<DiagnosticDocument>;
  if (typeof doc.version !== "string" || !Array.isArray(doc.diagnostics)) {
    throw new Error(
      'soroban-lint JSON output is missing the "version"/"diagnostics" fields',
    );
  }
  return { version: doc.version, diagnostics: doc.diagnostics };
}

/** Counts per severity, plus the total. */
export interface SeverityCounts {
  errors: number;
  warnings: number;
  notices: number;
  total: number;
}

/** Tally diagnostics by severity. */
export function summarize(diagnostics: readonly Diagnostic[]): SeverityCounts {
  const counts: SeverityCounts = { errors: 0, warnings: 0, notices: 0, total: 0 };
  for (const diagnostic of diagnostics) {
    counts.total += 1;
    switch (annotationLevel(diagnostic.severity)) {
      case "error":
        counts.errors += 1;
        break;
      case "warning":
        counts.warnings += 1;
        break;
      case "notice":
        counts.notices += 1;
        break;
    }
  }
  return counts;
}

/** A single GitHub Actions annotation. */
export interface Annotation {
  level: AnnotationLevel;
  message: string;
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  title: string;
}

/** Convert a diagnostic into a workflow-command annotation. */
export function toAnnotation(diagnostic: Diagnostic): Annotation {
  const help = diagnostic.help === null ? "" : `\n\nHelp: ${diagnostic.help}`;
  return {
    level: annotationLevel(diagnostic.severity),
    message: `${diagnostic.message} (${diagnostic.confidence} confidence)${help}`,
    file: diagnostic.file,
    startLine: diagnostic.start_line,
    startColumn: diagnostic.start_column,
    endLine: diagnostic.end_line,
    endColumn: diagnostic.end_column,
    title: `${diagnostic.rule_id} ${diagnostic.severity}`,
  };
}

/**
 * Cap the annotations so a large repository cannot flood the run's annotation
 * budget; the caller reports how many were dropped.
 */
export function limitAnnotations(
  annotations: readonly Annotation[],
  max: number,
): { emitted: Annotation[]; dropped: number } {
  if (max < 0 || annotations.length <= max) {
    return { emitted: [...annotations], dropped: 0 };
  }
  return { emitted: annotations.slice(0, max), dropped: annotations.length - max };
}
