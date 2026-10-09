/**
 * Production build for published sites.
 *
 * The preview runs every source file as its own module with dependencies from
 * the esm.sh import map. A published site used to ship exactly that: one
 * unminified .js per source file (with inline source maps embedding the TSX),
 * a live dependency on the CDN, and an import waterfall.
 *
 * Here the same Babel transform feeds esbuild, which bundles the app AND its
 * dependencies (fetched once from the CDN, cached on disk), tree-shakes,
 * minifies and content-hashes the output. Dynamic imports become chunks. If
 * the CDN cannot be reached, dependencies stay external behind an import map
 * limited to what the app really imports.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

import { cssCdnUrl, DEFAULT_CDN_IMPORTS } from "./importmap.mjs";
import { resolveSpecifier } from "./resolve.mjs";
import { transform } from "./transform.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = (await import("node:module")).createRequire(import.meta.url);
const MANIFEST = require("./packages.json");
const CDN_ORIGIN = new URL(MANIFEST.cdn).origin;
const SOURCE_RE = /\.(tsx|ts|jsx|js)$/i;
const STYLE_RE = /\.(css|scss|sass|less)(\?.*)?$/i;
export const ASSET_RE = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wav)(\?.*)?$/i;
const NPM_BUNDLED = new Set(
  Object.entries(MANIFEST.packages)
    .filter(([, spec]) => spec.npm)
    .map(([name]) => name),
);
const FETCH_TIMEOUT_MS = 20_000;

/** "@scope/pkg/sub" -> "@scope/pkg", "pkg/sub" -> "pkg". */
function packageRoot(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
const MAX_MODULE_BYTES = 8 * 1024 * 1024;

function cacheDir() {
  const dir = process.env.FORGE_CDN_CACHE_DIR || join(tmpdir(), "forge-cdn-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ask esm.sh for a browser build whatever the fetching runtime (Node here). */
function withBrowserTarget(url) {
  const parsed = new URL(url);
  if (!/\.(m?js|css)$/i.test(parsed.pathname) && !parsed.searchParams.has("target")) {
    parsed.searchParams.set("target", "es2022");
  }
  return parsed.href;
}

/**
 * GET from the CDN with a disk cache keyed by URL (pinned versions make the
 * content immutable). Only the manifest CDN origin is ever fetched.
 * @param {string} url
 */
export async function fetchCdn(url) {
  const target = withBrowserTarget(url);
  if (new URL(target).origin !== CDN_ORIGIN) throw new Error(`refusing non-CDN module ${target}`);
  const key = createHash("sha256").update(target).digest("hex");
  const file = join(cacheDir(), key);
  try {
    return readFileSync(file, "utf8");
  } catch {
    /* cache miss */
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // esm.sh picks builds by User-Agent and errors on some assets for Node's.
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ForgePublish/2.0) Chrome/126 Safari/537.36" },
    });
    if (!res.ok) throw new Error(`CDN ${res.status} for ${target}`);
    if (new URL(res.url).origin !== CDN_ORIGIN) throw new Error(`CDN redirected off-origin: ${res.url}`);
    const body = await res.text();
    if (body.length > MAX_MODULE_BYTES) throw new Error(`CDN module too large: ${target}`);
    writeFileSync(file, body, "utf8");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {Record<string, string>} imports
 * @param {string} spec
 */
function lookupImportMap(imports, spec) {
  if (imports[spec]) return imports[spec];
  let best = "";
  for (const key of Object.keys(imports)) {
    if (key.endsWith("/") && spec.startsWith(key) && key.length > best.length) best = key;
  }
  return best ? imports[best] + spec.slice(best.length) : null;
}

/**
 * @param {{
 *   files: Record<string, string>,
 *   entry: string,
 *   extraImports?: Record<string, string>,
 *   assetPaths?: string[],
 *   external?: boolean,
 * }} input
 */
export async function buildSite(input) {
  const files = input.files || {};
  const entry = input.entry || "src/main.tsx";
  const imports = { ...DEFAULT_CDN_IMPORTS, ...(input.extraImports || {}) };
  const assetSet = new Set(input.assetPaths || []);
  /** @type {any[]} */
  const errors = [];
  /** @type {Map<string, string>} */
  const transformed = new Map();

  for (const [path, content] of Object.entries(files)) {
    if (!SOURCE_RE.test(path) || path.includes("vite.config") || path.includes("node_modules")) continue;
    const r = transform(content, path, { production: true });
    if (r.error) {
      errors.push(r.error);
      continue;
    }
    for (const imp of r.imports) {
      if (imp.kind !== "bare") continue;
      const spec = imp.specifier;
      if (cssCdnUrl(spec) || lookupImportMap(imports, spec)) continue;
      errors.push({ path, message: `IMPORT_NOT_IN_MANIFEST: "${spec}" is not in the CDN import map` });
    }
    transformed.set(path, r.code);
  }
  if (!transformed.has(entry)) {
    errors.push({ path: entry, message: `Entry not found or failed to transform: ${entry}` });
  }
  if (errors.length) return { ok: false, errors };

  const external = Boolean(input.external);
  /** @type {Set<string>} */
  const cssImports = new Set();
  /** @type {Set<string>} */
  const assets = new Set();
  /** @type {Set<string>} */
  const usedBare = new Set();

  /** @type {import("esbuild").Plugin} */
  const plugin = {
    name: "forge-site",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        const spec = args.path;
        if (args.kind === "entry-point") return { path: entry, namespace: "local" };
        // Second pass of build.resolve() below: let esbuild's node resolution run.
        if (args.pluginData && args.pluginData.npm) return undefined;

        // Inside an npm-bundled package (node_modules): its own files resolve
        // normally, React and friends come from the same CDN copy as the app.
        if (args.namespace === "file") {
          if (spec.startsWith(".") || spec.startsWith("/") || NPM_BUNDLED.has(packageRoot(spec))) return undefined;
          if (external) {
            // Must reach the import map too, even when the app never imports it itself.
            usedBare.add(spec);
            return { path: spec, external: true };
          }
          const url = lookupImportMap(imports, spec);
          return url ? { path: url, namespace: "cdn" } : { errors: [{ text: `unresolved ${spec}` }] };
        }

        if (args.namespace === "cdn") {
          if (spec.startsWith("/")) return { path: new URL(spec, CDN_ORIGIN).href, namespace: "cdn" };
          if (/^https?:\/\//.test(spec)) {
            if (new URL(spec).origin !== CDN_ORIGIN) return { errors: [{ text: `off-CDN import ${spec}` }] };
            return { path: spec, namespace: "cdn" };
          }
          if (spec.startsWith(".")) return { path: new URL(spec, args.importer).href, namespace: "cdn" };
          const url = lookupImportMap(imports, spec);
          return url ? { path: url, namespace: "cdn" } : { errors: [{ text: `unresolved ${spec}` }] };
        }

        // From project code.
        const bare = !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("@/");
        if (bare) {
          const cssUrl = cssCdnUrl(spec);
          if (cssUrl) {
            cssImports.add(cssUrl);
            return { path: spec, namespace: "empty" };
          }
          if (NPM_BUNDLED.has(packageRoot(spec))) {
            // Tree-shaken from the real package (sideEffects: false), so only
            // the icons the site uses ship.
            return build.resolve(spec, { kind: args.kind, resolveDir: HERE, pluginData: { npm: true } });
          }
          usedBare.add(spec);
          if (external) return { path: spec, external: true };
          const url = lookupImportMap(imports, spec);
          return url ? { path: url, namespace: "cdn" } : { errors: [{ text: `not in import map: ${spec}` }] };
        }
        if (STYLE_RE.test(spec)) return { path: spec, namespace: "empty" };
        if (ASSET_RE.test(spec)) {
          const base = spec.startsWith("@/")
            ? "src/" + spec.slice(2)
            : spec.startsWith("/")
              ? spec.slice(1)
              : join(dirname(args.importer), spec).replace(/\\/g, "/");
          const clean = base.split("?")[0];
          if (!assetSet.has(clean)) return { errors: [{ text: `ASSET_NOT_FOUND: ${spec}` }] };
          assets.add(clean);
          return { path: clean, namespace: "asset" };
        }
        const resolved = resolveSpecifier(args.importer, spec, files);
        if (!resolved || !transformed.has(resolved)) {
          return { errors: [{ text: `MODULE_NOT_FOUND: ${spec} (case-sensitive)` }] };
        }
        return { path: resolved, namespace: "local" };
      });
      build.onLoad({ filter: /.*/, namespace: "local" }, (args) => ({
        contents: transformed.get(args.path) || "",
        loader: "js",
      }));
      build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "js" }));
      build.onLoad({ filter: /.*/, namespace: "asset" }, (args) => ({
        contents: `export default ${JSON.stringify("/" + args.path)};`,
        loader: "js",
      }));
      build.onLoad({ filter: /.*/, namespace: "cdn" }, async (args) => ({
        contents: await fetchCdn(args.path),
        loader: "js",
      }));
    },
  };

  const outdir = join(tmpdir(), "forge-build-out");
  const cwd = process.cwd();
  // Output paths relative to outdir, "/"-separated whatever the OS.
  const rel = (p) => relative(outdir, resolve(cwd, p)).split("\\").join("/");
  let result;
  try {
    result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      splitting: true,
      format: "esm",
      platform: "browser",
      target: ["es2020"],
      minify: true,
      legalComments: "none",
      charset: "utf8",
      write: false,
      metafile: true,
      outdir,
      entryNames: "assets/[name]-[hash]",
      chunkNames: "assets/[name]-[hash]",
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
      plugins: [plugin],
    });
  } catch (e) {
    const failure = /** @type {any} */ (e);
    const messages = (failure.errors || [{ text: String(failure.message || failure) }]).map((m) => ({
      path: m.location?.file || entry,
      message: m.text,
    }));
    // A CDN outage must not block a publish: retry with dependencies external.
    if (!external && messages.some((m) => /CDN|fetch|abort|ENOTFOUND|ECONN|network/i.test(m.message))) {
      return buildSite({ ...input, external: true });
    }
    return { ok: false, errors: messages };
  }

  /** @type {{ path: string, contents: string }[]} */
  const outputs = result.outputFiles.map((f) => ({
    path: rel(f.path),
    contents: f.text,
  }));
  const meta = result.metafile.outputs;
  const entryKey = Object.keys(meta).find((k) => meta[k].entryPoint);
  const entryFile = rel(entryKey);
  // Static chunk graph of the entry, for <link rel="modulepreload">.
  const preload = [];
  const walk = (key) => {
    for (const imp of meta[key]?.imports || []) {
      if (imp.kind !== "import-statement" || imp.external) continue;
      const file = rel(imp.path);
      if (!preload.includes(file)) {
        preload.push(file);
        walk(imp.path);
      }
    }
  };
  walk(entryKey);

  /** @type {Record<string, string>} */
  const importMap = {};
  if (external) {
    for (const spec of usedBare) {
      const url = lookupImportMap(imports, spec);
      if (url) importMap[spec] = url;
    }
  }
  return {
    ok: true,
    errors: [],
    mode: external ? "external" : "bundled",
    outputs,
    entryFile,
    preload,
    importMap,
    cssImports: [...cssImports],
    assets: [...assets],
  };
}
