#!/usr/bin/env node
/**
 * Standalone bundle of the Forge Design codelab player, for published
 * codelabs and the PDF export.
 *
 *   node build.mjs            (in the API image, after `npm ci` here)
 *   npm run build:codelab-player   (from apps/web in a checkout)
 *
 * Source: the web app's `components/codelab-player` (plus the deck player's
 * theme reader it shares). In the API image the Dockerfile copies both to
 * `player-src/components/`; in a checkout they are read from apps/web.
 * React, react-markdown, remark-gfm, Shiki and lucide-react come from this
 * package's node_modules when installed, else from the web app's.
 *
 * Output: `dist/` with ES modules, minified, content hashed, one chunk per
 * Shiki grammar (a page only downloads the languages it shows), and
 * `manifest.json` ({ entry, files, bytes, entryBytes }) read by
 * `app/services/codelab/publish.py`.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "dist");

/** Root that holds `components/codelab-player` (the alias target of "@"). */
function sourceRoot() {
  const candidates = [
    process.env.FORGE_CODELAB_PLAYER_SRC,
    join(HERE, "player-src"),
    resolve(HERE, "..", "..", "..", "web"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, "components", "codelab-player", "standalone.tsx"))) return dir;
  }
  throw new Error(`codelab player source not found (looked in ${candidates.join(", ")})`);
}

async function loadEsbuild(root) {
  for (const base of [HERE, root]) {
    try {
      const path = createRequire(join(base, "noop.js")).resolve("esbuild");
      return await import(pathToFileURL(path).href);
    } catch {
      // next candidate
    }
  }
  throw new Error("esbuild not found: npm ci in apps/api/runtime or apps/web");
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const root = sourceRoot();
const esbuild = await loadEsbuild(root);
const ownModules = join(HERE, "node_modules");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const result = await esbuild.build({
  entryPoints: { player: join(root, "components", "codelab-player", "standalone.tsx") },
  outdir: OUT,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  entryNames: "[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  jsx: "automatic",
  alias: { "@": root },
  nodePaths: existsSync(ownModules) ? [ownModules] : [],
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
  logLevel: "warning",
});

const entry = Object.entries(result.metafile.outputs).find(
  ([path, meta]) => meta.entryPoint && /(^|[\\/])player-[A-Z0-9]+\.js$/.test(path),
)?.[0];
if (!entry) throw new Error("no entry output");

const outputs = walk(OUT);
const bytes = outputs.reduce((sum, path) => sum + statSync(path).size, 0);
const entryName = resolve(entry).slice(OUT.length + 1).replaceAll("\\", "/");
const entryBytes = statSync(join(OUT, entryName)).size;
writeFileSync(
  join(OUT, "manifest.json"),
  `${JSON.stringify({ entry: entryName, files: outputs.length, bytes, entryBytes }, null, 2)}\n`,
);
console.log(
  `codelab player: ${entryName} ${(entryBytes / 1024).toFixed(0)} KB, ${outputs.length} files, ${(bytes / 1024).toFixed(0)} KB total`,
);
