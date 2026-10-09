/**
 * Shared Babel transform — identical contract for preview runner and publish CLI.
 */
import Babel from "@babel/standalone";

const PRESETS = [
  ["react", { runtime: "automatic" }],
  ["typescript", { isTSX: true, allExtensions: true }],
];

/** @typedef {{ specifier: string, kind: "relative"|"alias"|"bare", start: number, end: number }} ImportRef */
/** @typedef {{ path: string, message: string, line?: number, column?: number }} TransformError */
/** @typedef {{ code: string, imports: ImportRef[], error: TransformError|null }} TransformResult */

/**
 * @param {string} specifier
 * @returns {"relative"|"alias"|"bare"}
 */
export function classifySpecifier(specifier) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return "relative";
  if (specifier.startsWith("@/") || specifier.startsWith("/")) return "alias";
  return "bare";
}

const STATEMENT_IMPORT_RES = [
  // Side-effect: import "./x.css";
  /\bimport\s*["']([^"']+)["']\s*;?/g,
  // Named/default: import X from "y";
  // No quotes between `import` and `from` so we never span into string literals
  // (e.g. children: "or start from" after `export function …`).
  /\bimport\s+(?:type\s+)?(?:[^"'`;]+?)\s+from\s*["']([^"']+)["']/g,
  // Re-export only — never bare `export function` / `export const`.
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/g,
  // Dynamic: import("y")
  /\bimport\s*\(\s*["']([^"']+)["']/g,
];

/** Reject regex false-positives that look like Babel/JSX fragments, not packages. */
export function isPlausibleModuleSpecifier(specifier) {
  if (!specifier || specifier.length > 200) return false;
  if (/[\s\r\n{},;()]/.test(specifier)) return false;
  if (/\/\*|\*\/|#__PURE__|_jsxs?/.test(specifier)) return false;
  return true;
}

/**
 * @param {string} code
 * @returns {ImportRef[]}
 */
export function collectImports(code) {
  /** @type {ImportRef[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const pattern of STATEMENT_IMPORT_RES) {
    const re = new RegExp(pattern.source, "g");
    let m;
    while ((m = re.exec(code))) {
      const specifier = m[1];
      if (!specifier || !isPlausibleModuleSpecifier(specifier)) continue;
      const absStart = m.index + m[0].lastIndexOf(specifier);
      const key = `${absStart}:${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        specifier,
        kind: classifySpecifier(specifier),
        start: absStart,
        end: absStart + specifier.length,
      });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Published builds only: `<img>` without an explicit `loading` gets
 * `loading="lazy" decoding="async"`, except the one marked
 * `fetchPriority="high"` (the hero image is meant to load eagerly).
 * @param {any} api
 */
export function lazyImagesPlugin(api) {
  const t = api.types;
  const hasAttr = (attrs, names) =>
    attrs.some(
      (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && names.includes(a.name.name),
    );
  return {
    visitor: {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || name.name !== "img") return;
        const attrs = path.node.attributes;
        if (attrs.some((a) => t.isJSXSpreadAttribute(a))) return;
        if (hasAttr(attrs, ["loading", "fetchPriority", "fetchpriority"])) return;
        attrs.push(t.jsxAttribute(t.jsxIdentifier("loading"), t.stringLiteral("lazy")));
        if (!hasAttr(attrs, ["decoding"])) {
          attrs.push(t.jsxAttribute(t.jsxIdentifier("decoding"), t.stringLiteral("async")));
        }
      },
    },
  };
}

/**
 * @param {string} code
 * @param {string} path
 * @param {{ production?: boolean }} [options] production: no source maps,
 *   lazy images (publish). Preview keeps inline source maps for debugging.
 * @returns {TransformResult}
 */
export function transform(code, path, options = {}) {
  const production = Boolean(options.production);
  try {
    const out = Babel.transform(code, {
      filename: path,
      presets: PRESETS,
      plugins: production ? [lazyImagesPlugin] : [],
      // Inline maps would ship the original TSX inside every published file.
      sourceMaps: production ? false : "inline",
      compact: false,
      configFile: false,
      babelrc: false,
    });
    const js = out.code || "";
    return { code: js, imports: collectImports(js), error: null };
  } catch (e) {
    const err = /** @type {any} */ (e);
    return {
      code: "",
      imports: [],
      error: {
        path,
        message: String(err?.message || err),
        line: err?.loc?.line,
        column: err?.loc?.column,
      },
    };
  }
}
