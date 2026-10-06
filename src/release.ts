/** Resolving and addressing the prebuilt binaries published by `soroban-lint-core`. */

/** Direct download URLs for an archive and its sibling checksum file. */
export interface AssetUrls {
  archive: string;
  checksum: string;
}

/** Build the public release-asset URLs for a tag and asset name. */
export function assetUrls(repository: string, tag: string, asset: string): AssetUrls {
  const base = `https://github.com/${repository}/releases/download/${tag}`;
  return { archive: `${base}/${asset}`, checksum: `${base}/${asset}.sha256` };
}

/** The GitHub API URL for a repository's latest release. */
export function latestReleaseApi(repository: string): string {
  return `https://api.github.com/repos/${repository}/releases/latest`;
}

/**
 * Resolve the newest published release tag.
 *
 * @throws if the API call fails or the release has no tag (for example a
 *   repository whose releases are all prereleases).
 */
export async function resolveLatestTag(repository: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "soroban-lint-action",
  };
  if (token !== undefined && token !== "") {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(latestReleaseApi(repository), { headers });
  if (!response.ok) {
    throw new Error(
      `cannot resolve the latest release of ${repository}: HTTP ${response.status} ${response.statusText}. ` +
        'Pin one explicitly with the "version" input.',
    );
  }

  const body = (await response.json()) as { tag_name?: unknown };
  if (typeof body.tag_name !== "string" || body.tag_name === "") {
    throw new Error(`${repository} has no published release tag`);
  }
  return body.tag_name;
}
