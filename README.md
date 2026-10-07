# soroban-lint-action

Run [`soroban-lint`](https://github.com/Stellar-Soroban-Lint/soroban-lint-core) on a repository.

The action downloads the prebuilt `soroban-lint` CLI for the runner platform from a
`soroban-lint-core` release, **verifies its SHA-256 checksum against the checksum published
alongside the release asset**, and only then runs it. It never builds from source and never uses
Docker.

> soroban-lint performs syntactic, per-file analysis of Soroban contract source using the Rust AST. It flags patterns associated with missing authorization checks, panic paths, unchecked arithmetic, and storage hazards in `#[contractimpl]` functions. It does not expand macros, resolve types, or follow calls across files, so it can miss real issues (false negatives) and flag safe code (false positives). A clean report is not evidence a contract is secure, and this tool is not a substitute for an audit.

## Usage

```yaml
name: lint

on:
  pull_request:

permissions:
  contents: read

jobs:
  soroban-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          path: contracts
          fail-on: error
```

Findings are reported as annotations on the changed files, the job summary counts them, and the step
fails when a finding meets the `fail-on` threshold. On a pull request the action also posts a summary
comment and updates it in place on later pushes.

The action needs `contents: read` to download the release. Posting the summary comment additionally
needs `pull-requests: write` (see [Fork pull requests](#fork-pull-requests)).

### Enabling the experimental rules

SL003–SL007 (unchecked arithmetic, unbounded storage growth, missing TTL extension, questionable
storage type, unprotected initializer) are off by default. Turn them on deliberately:

```yaml
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          path: contracts
          experimental: "true"
          fail-on: warning
```

### Uploading SARIF

```yaml
jobs:
  soroban-lint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          path: contracts
          sarif-file: soroban-lint.sarif
          fail-on: never
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: soroban-lint.sarif
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `version` | `latest` | `soroban-lint-core` release tag to install (e.g. `v0.1.0`), or `latest`. |
| `repository` | `Stellar-Soroban-Lint/soroban-lint-core` | Repository that publishes the binaries. |
| `path` | `.` | File or directory to lint. |
| `fail-on` | `error` | Minimum severity that fails the step: `error`, `warning`, `info`, or `never`. |
| `experimental` | `false` | Enable the experimental rules. |
| `config` | – | Path to a `soroban-lint.toml`. Auto-discovered when omitted. |
| `args` | – | Extra whitespace-separated arguments appended to `soroban-lint check`. |
| `annotations` | `true` | Emit one workflow annotation per finding. |
| `max-annotations` | `50` | Cap on emitted annotations. |
| `comment` | `true` | Post a summary comment on a pull request and update it in place on later pushes. |
| `checksum` | – | Expected SHA-256 of the archive, to pin beyond the published checksum. |
| `sarif-file` | – | When set, also write a SARIF 2.1.0 report to this path. |
| `token` | – | Token used only to raise API rate limits; not required for public releases. |

## Outputs

| Output | Description |
|---|---|
| `version` | The installed release tag. |
| `binary` | Absolute path to the installed executable (also added to `PATH`). |
| `findings` | Total number of findings. |
| `errors` / `warnings` / `notices` | Findings per severity. |
| `exit-code` | Exit code returned by `soroban-lint check`. |
| `sarif-file` | Path written when `sarif-file` is set. |

## Pinning

`latest` is convenient but not reproducible. Pin a release tag, and optionally the archive digest:

```yaml
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          version: v0.1.0
          checksum: 0000000000000000000000000000000000000000000000000000000000000000
```

The checksum for each archive is published as `<archive>.sha256` on the release page.

## Supported runners

`x86_64`/`aarch64` Linux, `x86_64`/`aarch64` macOS, and `x86_64` Windows. The action runs on the
`node24` runtime.

## Fork pull requests

A pull request from a fork runs with a read-only `GITHUB_TOKEN`, so writing a comment or a check
fails. The action treats that as expected: it logs a warning and continues. The workflow-command
annotations and the job summary still work, which is why the pull request still shows the findings.
The summary comment and any SARIF upload are skipped.

## GitHub limits

The action is designed around GitHub's caps rather than discovering them in production:

| Limit | Value | How the action handles it |
|---|---|---|
| Workflow-command annotations | 10 per step, 50 per job | `max-annotations` (default `50`) caps emission; the dropped count is logged, never hidden |
| Checks API annotations | 50 per request | Not called directly; the optional SARIF upload is the bulk channel |
| Pull request comment body | 65,536 characters | The comment lists at most 20 findings, then points at the annotations and SARIF |
| Default `GITHUB_TOKEN` | Read-only for fork pull requests; read/write scope set by the repository's **Workflow permissions** | Writing the comment needs `pull-requests: write`; the action skips it rather than failing |

When there are more findings than the cap, nothing is silently dropped: the remainder is counted in
the log, listed in the job summary, and included in the SARIF file if `sarif-file` is set.

## Development

```bash
npm ci
npm run verify   # typecheck, unit tests, and a rebuild of dist/index.js
```

`dist/index.js` is committed because GitHub executes it directly; CI fails if it is out of date
with `src/`.

## Related repositories

- [`soroban-lint-core`](https://github.com/Stellar-Soroban-Lint/soroban-lint-core) — the engine and the released binaries this action downloads.
- [`soroban-lint-portal`](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal) — browser playground running the same engine as WebAssembly.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).
