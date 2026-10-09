# Contributing

Thanks for helping. This is a security tool's CI integration, so precision matters
more than volume.

Keep this statement of scope in mind in every change, issue, and review:

> soroban-lint performs syntactic, per-file analysis of Soroban contract source using the Rust AST. It flags patterns associated with missing authorization checks, panic paths, unchecked arithmetic, and storage hazards in `#[contractimpl]` functions. It does not expand macros, resolve types, or follow calls across files, so it can miss real issues (false negatives) and flag safe code (false positives). A clean report is not evidence a contract is secure, and this tool is not a substitute for an audit.

## Ground rules

- **No overclaiming.** Never describe the action or the linter as detecting "all" of
  anything, and never present a limitation as a footnote. State the limitation in the
  same paragraph as the capability claim.
- **No fake CLI output.** Tests use output recorded from a real released CLI binary,
  not hand-written JSON. If the released binary's shape changes, the fixtures change
  with it.
- **The checksum check is not optional.** Any change to download or extraction must
  keep verifying the archive's SHA-256 against the published checksum before running
  it, and must fail closed.
- **Do not weaken a test to make it pass.** Fix the cause.

## Setup

```bash
git clone https://github.com/Stellar-Soroban-Lint/soroban-lint-action
cd soroban-lint-action
npm ci
npm run verify   # typecheck, unit tests, and a rebuild of dist/index.js
```

`dist/index.js` is committed because GitHub executes it directly. CI fails if it is
out of date with `src/`.

## Commits

Conventional commits: `feat: …`, `fix: …`, `test: …`, `docs: …`. One logical change
per commit. When `src/` changes, rebuild `dist/` in the same commit.

## Branch protection

`main` is protected (pull request + one review + required status checks). Don't push
directly unless you are the bypass actor.

## License

By contributing you agree your contribution is licensed under the repository's
`MIT OR Apache-2.0` terms.
