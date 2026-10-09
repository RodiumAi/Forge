/**
 * Browser import map, derived from the shared closed manifest (runtime/packages.json).
 *
 * This file MUST stay generated from packages.json — never hand-edit the map.
 * `app/runtime_manifest.py` reads the exact same file for the AST allowlist, so a
 * package validated at write time is always resolvable at runtime.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
/** @type {{reactVersion: string, cdn: string, packages: Record<string, {version: string, browser?: boolean, peerReact?: boolean, subpaths?: string[], deps?: string[], prefix?: boolean, css?: Record<string, string>, virtual?: boolean}>}} */
const MANIFEST = require("./packages.json");

/**
 * esm.sh `deps=` pins: React for React-dependent packages, plus the manifest
 * packages a library builds on (gsap for @gsap/react, three for fiber...), so
 * every module shares one copy.
 * @param {{peerReact?: boolean, deps?: string[]}} spec
 */
function depsQuery(spec) {
  const pins = [];
  if (spec.peerReact) {
    pins.push(`react@${MANIFEST.reactVersion}`, `react-dom@${MANIFEST.reactVersion}`);
  }
  for (const dep of spec.deps || []) {
    const pinned = MANIFEST.packages[dep];
    if (pinned) pins.push(`${dep}@${pinned.version}`);
  }
  return pins.length ? `?deps=${pins.join(",")}` : "";
}

/**
 * @param {string} name
 * @param {{version: string, peerReact?: boolean, deps?: string[]}} spec
 * @param {string} [subpath]
 */
function cdnUrl(name, spec, subpath) {
  const base = `${MANIFEST.cdn}/${name}@${spec.version}`;
  const path = subpath ? `/${subpath}` : "";
  return `${base}${path}${depsQuery(spec)}`;
}

/** @type {Record<string, string>} */
export const DEFAULT_CDN_IMPORTS = (() => {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, spec] of Object.entries(MANIFEST.packages)) {
    if (!spec.browser || spec.virtual) continue;
    out[name] = cdnUrl(name, spec);
    for (const subpath of spec.subpaths || []) {
      out[`${name}/${subpath}`] = cdnUrl(name, spec, subpath);
    }
    if (spec.prefix) {
      out[`${name}/`] = `${MANIFEST.cdn}/${name}@${spec.version}/`;
    }
  }
  return out;
})();

/** Manifest packages Forge provides itself (e.g. `@forge/forms`). */
export const VIRTUAL_PACKAGES = Object.entries(MANIFEST.packages)
  .filter(([, spec]) => spec.virtual)
  .map(([name]) => name);

/**
 * CDN stylesheet URL for a bare CSS import (`import "swiper/css"`), or null.
 * @param {string} specifier
 */
export function cssCdnUrl(specifier) {
  for (const [name, spec] of Object.entries(MANIFEST.packages)) {
    for (const [pattern, file] of Object.entries(spec.css || {})) {
      const matches = pattern.endsWith("/*")
        ? specifier.startsWith(pattern.slice(0, -1))
        : specifier === pattern;
      if (matches) return `${MANIFEST.cdn}/${name}@${spec.version}/${file}`;
    }
  }
  return null;
}

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
