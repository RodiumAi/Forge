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
 * @param {string} code
 * @param {string} path
 * @returns {TransformResult}
 */
export function transform(code, path) {
  try {
    const out = Babel.transform(code, {
      filename: path,
      presets: PRESETS,
      sourceMaps: "inline",
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
