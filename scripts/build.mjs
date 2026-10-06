/**
 * Bundles the action into the single committed file GitHub executes.
 *
 * The output is ESM (the action's `package.json` is `"type": "module"`). Some
 * transitive CommonJS dependencies of `@actions/tool-cache` (for example
 * `tunnel`) call `require()` on Node built-ins at load time. In an ESM bundle
 * esbuild's dynamic-require shim has no `require` in scope and throws, so the
 * banner restores one via `createRequire`.
 */

import { build } from "esbuild";

const banner = [
  "import { createRequire as __createRequire } from 'node:module';",
  "const require = __createRequire(import.meta.url);",
].join("\n");

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.js",
  banner: { js: banner },
  legalComments: "none",
  logLevel: "warning",
});
