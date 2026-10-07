# Security policy

## This tool aids review; it is not an audit

> soroban-lint performs syntactic, per-file analysis of Soroban contract source using the Rust AST. It flags patterns associated with missing authorization checks, panic paths, unchecked arithmetic, and storage hazards in `#[contractimpl]` functions. It does not expand macros, resolve types, or follow calls across files, so it can miss real issues (false negatives) and flag safe code (false positives). A clean report is not evidence a contract is secure, and this tool is not a substitute for an audit.

A passing workflow is not evidence a contract is secure. Treat every annotation as a
prompt for human review.

## Reporting a bug in the action

If the action downloads the wrong binary, reports findings the CLI did not, drops
annotations silently, or mishandles a fork pull request, open an issue:

https://github.com/Stellar-Soroban-Lint/soroban-lint-action/issues

Include the workflow file, the action ref, the runner OS, and the relevant log.

## A vulnerability in the action itself

The action executes a binary it downloads from a release. The properties we care about:

- the archive's SHA-256 is verified against the published checksum before extraction;
- a mismatch, a missing release, or a missing checksum fails the step;
- the `checksum` input can pin an expected digest.

If you find a way to bypass verification, cause code execution, or make the action
treat unparseable CLI output as a clean run, report it privately with a GitHub
security advisory on this repository rather than a public issue.

## Reporting a vulnerability you find in a third-party contract

The maintainers do **not** audit contracts and cannot triage third-party
vulnerabilities. Use the contract vendor's responsible-disclosure channel, the
Stellar/Soroban security resources (`https://developers.stellar.org/docs/tools/developer-tools/security-tools`),
or the Soroban Security Portal (`https://stellarsecurityportal.com`). Do not open a
public issue here containing a live exploit against a deployed contract.
