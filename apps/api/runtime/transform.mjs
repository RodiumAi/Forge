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

// forge-id-plugin:start (kept identical in public/runner.js, see tests/forge-id.test.mjs)
/** HTML and SVG tags that receive a preview `data-forge-id`. Other lowercase
 *  JSX names (react-three-fiber objects, custom renderers) are left alone:
 *  r3f reads a dashed prop as a nested path and would throw. */
const FORGE_ID_HOST_TAGS = new Set((
  "a abbr address area article aside audio b bdi bdo blockquote body br button canvas caption " +
  "cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset " +
  "figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i iframe img input ins kbd " +
  "label legend li main map mark menu meter nav noscript object ol optgroup option output p " +
  "picture pre progress q rp rt ruby s samp search section select slot small source span strong " +
  "sub summary sup table tbody td template textarea tfoot th thead time tr track u ul var video " +
  "wbr svg circle clipPath defs ellipse g line linearGradient mask path pattern polygon " +
  "polyline radialGradient rect stop symbol text tspan use"
).split(" "));
const FORGE_ID_ATTR = "data-forge-id";

/** Preview only: tag every host JSX element with `data-forge-id="<file>:<line>:<col>"`
 *  (1-based line and column of the opening `<`). Files importing a
 *  @react-three package are skipped: their lowercase tags are 3D objects. */
function forgeIdPreviewPlugin(api, opts) {
  const t = api.types;
  return {
    visitor: {
      Program(path, state) {
        state.forgeIdSkip = path.node.body.some(
          (s) =>
            t.isImportDeclaration(s) &&
            typeof s.source.value === "string" &&
            s.source.value.startsWith("@react-three/"),
        );
      },
      JSXOpeningElement(path, state) {
        if (state.forgeIdSkip) return;
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || !FORGE_ID_HOST_TAGS.has(name.name)) return;
        const loc = path.node.loc;
        if (!loc) return;
        const file = String((opts && opts.file) || state.filename || "");
        const value = file + ":" + loc.start.line + ":" + (loc.start.column + 1);
        const attrs = path.node.attributes;
        // An id copied into the source by hand would point at the wrong place:
        // the fresh location always wins.
        for (let i = attrs.length - 1; i >= 0; i--) {
          const a = attrs[i];
          if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === FORGE_ID_ATTR) {
            attrs.splice(i, 1);
          }
        }
        attrs.push(t.jsxAttribute(t.jsxIdentifier(FORGE_ID_ATTR), t.stringLiteral(value)));
      },
    },
  };
}
// forge-id-plugin:end

export { forgeIdPreviewPlugin, FORGE_ID_ATTR };

/**
 * Published builds only: drop any `data-forge-id` left in the source (the
 * preview ids are an editing aid and must never ship).
 * @param {any} api
 */
export function stripForgeIdsPlugin(api) {
  const t = api.types;
  return {
    visitor: {
      JSXOpeningElement(path) {
        const attrs = path.node.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const a = attrs[i];
          if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === FORGE_ID_ATTR) {
            attrs.splice(i, 1);
          }
        }
      },
    },
  };
}

/**
 * @param {string} code
 * @param {string} path
 * @param {{ production?: boolean, forgeIds?: boolean }} [options] production: no source
 *   maps, lazy images, preview ids stripped (publish). Preview keeps inline source
 *   maps for debugging; forgeIds tags host elements with `data-forge-id` (preview only,
 *   ignored when production is set).
 * @returns {TransformResult}
 */
export function transform(code, path, options = {}) {
  const production = Boolean(options.production);
  try {
    const out = Babel.transform(code, {
      filename: path,
      presets: PRESETS,
      plugins: production
        ? [stripForgeIdsPlugin, lazyImagesPlugin]
        : options.forgeIds
          ? [[forgeIdPreviewPlugin, { file: path }]]
          : [],
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
