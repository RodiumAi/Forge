/**
 * Stylesheet assembly shared by publish (cli.mjs) and mirrored by the preview
 * runner (public/runner.js keeps an inline copy: it cannot import Node files).
 *
 * Every project stylesheet loads into one document, foundation first. An
 * `@import` is only valid before any other rule, so the ones found anywhere
 * (typically the web-font import at the top of src/index.css, but also inside
 * a page stylesheet) are hoisted to the top, deduplicated, instead of being
 * silently ignored mid-sheet.
 */

// Quoted URLs may contain ";" (Google Fonts weights: wght@400;600), so the
// quoted form is matched up to its closing quote; bare url(...) up to ")".
const IMPORT_RE =
  /@import\s+(?:url\(\s*(["'])(.*?)\1\s*\)|(["'])(.*?)\3|url\(\s*([^)\s]+)\s*\))([^;]*);/g;

/**
 * @param {Record<string, string>} files
 * @returns {string[]} stylesheet paths, src/index.css first
 */
export function orderedCssPaths(files) {
  return Object.keys(files)
    .filter((p) => /\.css$/i.test(p))
    .sort((a, b) => {
      if (a === "src/index.css" || a === "index.css") return -1;
      if (b === "src/index.css" || b === "index.css") return 1;
      return a < b ? -1 : 1;
    });
}

/**
 * @param {Record<string, string>} files
 * @returns {{ css: string, imports: { url: string, media: string }[] }}
 */
export function assembleCss(files) {
  /** @type {{ url: string, media: string }[]} */
  const imports = [];
  const seen = new Set();
  const bodies = orderedCssPaths(files).map((path) =>
    String(files[path] || "").replace(IMPORT_RE, (_m, _q1, u1, _q2, u2, u3, media) => {
      const url = u1 || u2 || u3 || "";
      const key = `${url} ${media.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        imports.push({ url, media: media.trim() });
      }
      return "";
    }),
  );
  return { css: bodies.join("\n\n"), imports };
}

/**
 * The CSS text with its imports put back on top (preview / fallback form).
 * @param {{ css: string, imports: { url: string, media: string }[] }} assembled
 */
export function cssWithHoistedImports(assembled) {
  const head = assembled.imports
    .map((i) => `@import url("${i.url}")${i.media ? " " + i.media : ""};`)
    .join("\n");
  return head ? `${head}\n${assembled.css}` : assembled.css;
}

/** Google Fonts stylesheets are loaded with <link> + preconnect, not @import. */
export function isFontStylesheet(url) {
  return /^https:\/\/fonts\.(googleapis|bunny)\.(com|net)\//.test(url);
}
