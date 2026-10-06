import assert from "node:assert/strict";
import test from "node:test";

import { assetUrls, latestReleaseApi } from "../src/release.js";

test("asset URLs point at the release download path", () => {
  const urls = assetUrls(
    "Stellar-Soroban-Lint/soroban-lint-core",
    "v0.1.0",
    "soroban-lint-v0.1.0-x86_64-unknown-linux-gnu.tar.gz",
  );
  assert.equal(
    urls.archive,
    "https://github.com/Stellar-Soroban-Lint/soroban-lint-core/releases/download/v0.1.0/soroban-lint-v0.1.0-x86_64-unknown-linux-gnu.tar.gz",
  );
  assert.equal(
    urls.checksum,
    `${urls.archive}.sha256`,
    "the checksum must sit next to the archive it verifies",
  );
});

test("the latest-release endpoint is repository-scoped", () => {
  assert.equal(
    latestReleaseApi("Stellar-Soroban-Lint/soroban-lint-core"),
    "https://api.github.com/repos/Stellar-Soroban-Lint/soroban-lint-core/releases/latest",
  );
});
