/**
 * Preview mount: transform → topo → Blob URLs → dynamic import(entry).
 * Used by runner.js in the browser (Blob) and mirrored by cli for publish.
 */

import { transform } from "./transform.mjs";
import { topoSort } from "./topo.mjs";
import { rewriteSpecifiers } from "./rewrite.mjs";
import { toPublishJsPath } from "./resolve.mjs";
import { DEFAULT_CDN_IMPORTS } from "./importmap.mjs";

/**
 * SEO head carried from the project's index.html into the published page.
 *
 * The publish HTML used to be generated from scratch: every published site
 * shipped "<title>Forge app</title>" and the default favicon, silently
 * discarding everything the SEO editor had written.
 *
 * @param {string} html project index.html
 * @returns {{ title: string|null, tags: string[] }}
 */
export function extractSeoHead(html) {
  const head = (String(html || "").match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || "";
  const titleMatch = head.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const tags = [];
  let m;
  const metaRe = /<meta\b[^>]*\/?>/gi;
  while ((m = metaRe.exec(head))) {
    const tag = m[0];
    // charset/viewport are owned by the publish shell.
    if (/charset\s*=/i.test(tag) || /name=["']viewport["']/i.test(tag)) continue;
    tags.push(tag);
  }
  const linkRe = /<link\b[^>]*\/?>/gi;
  while ((m = linkRe.exec(head))) {
    const tag = m[0];
    if (/rel=["'][^"']*(icon|apple-touch-icon|canonical|manifest)[^"']*["']/i.test(tag)) {
      tags.push(tag);
    }
  }
  return { title: title || null, tags };
}

/**
 * @param {Record<string, string>} files
 * @param {string} entry
 * @param {"preview"|"publish"} mode
 * @param {Record<string, string>} [extraImports] project package.json deps
 *   (import-map entries; keys ending in "/" are subpath prefixes)
 */
export function buildGraph(files, entry, mode = "preview", extraImports = {}) {
  /** @type {Map<string, { code: string, imports: any[] }>} */
  const transformed = new Map();
  /** @type {any[]} */
  const errors = [];

  const importKeys = [...Object.keys(DEFAULT_CDN_IMPORTS), ...Object.keys(extraImports)];
  const exactBare = new Set(importKeys);
  const prefixBare = importKeys.filter((k) => k.endsWith("/"));
  const isAllowedBare = (spec) =>
    exactBare.has(spec) || prefixBare.some((prefix) => spec.startsWith(prefix));

  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(path)) continue;
    // Skip config / vite
    if (path.includes("vite.config") || path.includes("node_modules")) continue;
    const r = transform(content, path);
    if (r.error) {
      errors.push(r.error);
      continue;
    }
    for (const imp of r.imports) {
      if (imp.kind !== "bare") continue;
      // Exact key in the map (e.g. react/jsx-runtime) or a declared package's
      // subpath prefix — otherwise reject unknown packages.
      if (!isAllowedBare(imp.specifier)) {
        errors.push({
          path,
          message: `IMPORT_NOT_IN_MANIFEST: "${imp.specifier}" is not in the CDN import map`,
        });
      }
    }
    if (errors.some((e) => e.path === path && String(e.message).startsWith("IMPORT_NOT_IN_MANIFEST"))) {
      continue;
    }
    transformed.set(path, { code: r.code, imports: r.imports });
  }

  if (errors.length) {
    return { ok: false, errors, modules: null, order: null };
  }

  if (!transformed.has(entry)) {
    return {
      ok: false,
      errors: [{ path: entry, message: `Entry not found or failed to transform: ${entry}` }],
      modules: null,
      order: null,
    };
  }

  let order;
  try {
    order = topoSort(transformed, files);
  } catch (e) {
    const err = /** @type {Error} */ (e);
    return {
      ok: false,
      errors: [{ path: entry, message: err.message }],
      modules: null,
      order: null,
    };
  }

  /** @type {Map<string, string>} */
  const blobUrls = new Map();
  /** @type {Record<string, string>} */
  const modules = {};
  /** @type {{ from: string, specifier: string }[]} */
  const missing = [];

  for (const path of order) {
    const info = transformed.get(path);
    if (!info) continue;
    const { code, missing: miss } = rewriteSpecifiers(
      info.code,
      info.imports,
      path,
      files,
      mode,
      blobUrls,
    );
    missing.push(...miss);
    if (mode === "preview") {
      // Browser only — Blob. In Node CLI preview path we just store code.
      if (typeof Blob !== "undefined" && typeof URL !== "undefined") {
        const blob = new Blob([code], { type: "text/javascript" });
        blobUrls.set(path, URL.createObjectURL(blob));
      } else {
        blobUrls.set(path, `blob:mock/${path}`);
      }
      modules[path] = code;
    } else {
      modules[toPublishJsPath(path)] = code;
    }
  }

  if (missing.length) {
    return {
      ok: false,
      errors: missing.map((m) => ({
        path: m.from,
        message: `MODULE_NOT_FOUND: ${m.specifier} (case-sensitive)`,
      })),
      modules: null,
      order: null,
    };
  }

  return {
    ok: true,
    errors: [],
    modules,
    order,
    entryUrl: mode === "preview" ? blobUrls.get(entry) : toPublishJsPath(entry),
    blobUrls,
  };
}
