<p align="center">
  <img src="docs/assets/banner.svg" alt="soroban-lint-action — Soroban contract checks in GitHub Actions" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Stellar-Soroban-Lint/soroban-lint-action/actions/workflows/ci.yml"><img src="https://github.com/Stellar-Soroban-Lint/soroban-lint-action/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <a href="https://stellar-soroban-lint.github.io/soroban-lint-core/"><img src="https://img.shields.io/badge/docs-online-7C3AED" alt="Documentation"></a>
  <a href="https://discord.gg/xZRZT6TpB"><img src="https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://t.me/+MrTh9uraIS5jMjhk"><img src="https://img.shields.io/badge/Telegram-join-26A5E4?logo=telegram&logoColor=white" alt="Telegram"></a>
</p>

`soroban-lint-action` runs the Soroban linter on pull requests and reports findings as annotations and a summary comment. It downloads the CLI from a core release and verifies the published SHA-256 before running it. soroban-lint performs syntactic, per-file analysis of Soroban contract source using the Rust AST. It flags patterns associated with missing authorization checks, panic paths, unchecked arithmetic, and storage hazards in `#[contractimpl]` functions. It does not expand macros, resolve types, or follow calls across files, so it can miss real issues (false negatives) and flag safe code (false positives). A clean report is not evidence a contract is secure, and this tool is not a substitute for an audit.

[Docs](https://stellar-soroban-lint.github.io/soroban-lint-core/) · [Playground](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal) · [Core CLI](https://github.com/Stellar-Soroban-Lint/soroban-lint-core) · [Demo PR](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal/pull/1) · [Issues](https://github.com/Stellar-Soroban-Lint/soroban-lint-action/issues)

## What it does

The action downloads a release binary, verifies its SHA-256 against the checksum published with that release, and runs the linter. It can annotate changed lines, update a pull request summary comment in place, and write SARIF for GitHub code scanning.

## Quick start

```yaml
name: soroban-lint
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          path: contracts
          fail-on: error
```

`pull-requests: write` lets the action post and update its summary comment. For forks, GitHub provides a read-only token; the action skips the comment and continues with annotations and the job summary. Use `sarif-file` with `security-events: write` and `github/codeql-action/upload-sarif` to upload SARIF.

### Inputs

| Input | Default | Description |
|---|---|---|
| `version` | `latest` | Core release tag to install, or `latest`. |
| `repository` | `Stellar-Soroban-Lint/soroban-lint-core` | Repository that publishes the binaries. |
| `path` | `.` | File or directory to lint. |
| `fail-on` | `error` | Minimum severity that fails the step: `error`, `warning`, `info`, or `never`. |
| `experimental` | `false` | Enable experimental rules SL003–SL007. |
| `config` | auto-discover | Path to a `soroban-lint.toml`. |
| `args` | empty | Extra whitespace-separated arguments for `soroban-lint check`. |
| `annotations` | `true` | Emit workflow annotations. |
| `comment` | `true` | Post and update a pull request summary comment. Skipped on fork PRs. |
| `max-annotations` | `50` | Maximum emitted annotations. |
| `checksum` | empty | Expected archive SHA-256, for pinning beyond the published checksum. |
| `sarif-file` | empty | Also write a SARIF 2.1.0 report to this path. |
| `token` | empty | Token used only to raise API rate limits. |

### Outputs

| Output | Description |
|---|---|
| `version` | Installed release tag. |
| `binary` | Absolute path to the executable, added to `PATH`. |
| `findings` | Total findings. |
| `errors` / `warnings` / `notices` | Findings by severity. |
| `exit-code` | Exit code returned by `soroban-lint check`. |
| `sarif-file` | Report path when `sarif-file` is set. |

### Pin a release and checksum

The digest is specific to the runner platform. This is the v0.1.2 Linux x86_64 archive digest:

```yaml
      - uses: Stellar-Soroban-Lint/soroban-lint-action@v0
        with:
          version: v0.1.2
          checksum: c2b2bcf5f01d2591b44a411b7c6724b4cc0c00671a8062e6a82deb26cea89538
```

See the [v0.1.2 release assets](https://github.com/Stellar-Soroban-Lint/soroban-lint-core/releases/tag/v0.1.2) for the other platform digests.

## Architecture

The core data flow is `source → syn AST → rule visitors → Diagnostics → text | JSON | SARIF | WASM`. This action downloads the selected release, verifies the archive checksum, and invokes the CLI. The linter does not expand macros, resolve types, or analyze calls across files. Findings need review; they are not proof that a contract is vulnerable or safe. See the [architecture documentation](https://stellar-soroban-lint.github.io/soroban-lint-core/architecture/).

## The ecosystem

| Repository | Role |
|---|---|
| [soroban-lint-core](https://github.com/Stellar-Soroban-Lint/soroban-lint-core) | Analysis engine, CLI, and release binaries. |
| [soroban-lint-action](https://github.com/Stellar-Soroban-Lint/soroban-lint-action) | Runs the CLI in GitHub Actions. |
| [soroban-lint-portal](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal) | Playground source; the hosted site currently returns 404. |
| Demo PRs ([#1](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal/pull/1), [#2](https://github.com/Stellar-Soroban-Lint/soroban-lint-portal/pull/2)) | Example annotation and `fail-on` runs; there is no separate demo repository. |

## Maintainers

| Name | GitHub | Telegram |
|---|---|---|
| ojuotimi932 | [@ojuotimi932](https://github.com/ojuotimi932) | [Telegram](https://t.me/+MrTh9uraIS5jMjhk) |

## Community
- Telegram: https://t.me/+MrTh9uraIS5jMjhk
- Discord: https://discord.gg/xZRZT6TpB

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), then choose an issue from the [good first issue list](https://github.com/Stellar-Soroban-Lint/soroban-lint-action/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
Run `npm ci` and `npm test`; use `npm run verify` before opening a PR.

## Contributors

[![Contributors](https://contrib.rocks/image?repo=Stellar-Soroban-Lint/soroban-lint-action)](https://github.com/Stellar-Soroban-Lint/soroban-lint-action/graphs/contributors)

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability. The linter aids code review; it is not an audit and does not prove a contract is secure.

## License

Licensed under [MIT](LICENSE).
