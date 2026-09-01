/**
 * Browser import map, derived from the shared closed manifest (runtime/packages.json).
 *
 * This file MUST stay generated from packages.json — never hand-edit the map.
 * `app/runtime_manifest.py` reads the exact same file for the AST allowlist, so a
 * package validated at write time is always resolvable at runtime.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
/** @type {{reactVersion: string, cdn: string, packages: Record<string, {version: string, browser?: boolean, peerReact?: boolean, subpaths?: string[]}>}} */
const MANIFEST = require("./packages.json");

const REACT_DEPS = `deps=react@${MANIFEST.reactVersion},react-dom@${MANIFEST.reactVersion}`;

/**
 * @param {string} name
 * @param {{version: string, peerReact?: boolean}} spec
 * @param {string} [subpath]
 */
function cdnUrl(name, spec, subpath) {
  const base = `${MANIFEST.cdn}/${name}@${spec.version}`;
  const path = subpath ? `/${subpath}` : "";
  const query = spec.peerReact ? `?${REACT_DEPS}` : "";
  return `${base}${path}${query}`;
}

/** @type {Record<string, string>} */
export const DEFAULT_CDN_IMPORTS = (() => {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, spec] of Object.entries(MANIFEST.packages)) {
    if (!spec.browser) continue;
    out[name] = cdnUrl(name, spec);
    for (const subpath of spec.subpaths || []) {
      out[`${name}/${subpath}`] = cdnUrl(name, spec, subpath);
    }
  }
  return out;
})();

/**
 * @param {Record<string, string>} [extra]
 */
export function buildImportMap(extra = {}) {
  return {
    imports: {
      ...DEFAULT_CDN_IMPORTS,
      ...extra,
    },
  };
}

export function importMapScriptTag(extra = {}) {
  const map = buildImportMap(extra);
  return `<script type="importmap">${JSON.stringify(map)}</script>`;
}
