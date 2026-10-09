/**
 * Rewrite import/export specifiers after transform.
 */

import { resolveSpecifier, toPublishJsPath } from "./resolve.mjs";

const ASSET_IMPORT_RE = /\.(svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wav)(\?.*)?$/i;

/**
 * Root URL of an imported asset, e.g. `/src/assets/logo.png`.
 * @param {string} fromPath
 * @param {string} specifier
 */
export function assetUrl(fromPath, specifier) {
  const clean = specifier.split("?")[0];
  if (clean.startsWith("@/")) return "/src/" + clean.slice(2);
  if (clean.startsWith("/")) return clean;
  const parts = (fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")).split("/") : []).concat(
    clean.split("/"),
  );
  const stack = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return "/" + stack.join("/");
}

/**
 * `import x from "./a.png"` → `const x = "/src/a.png";` (side-effect form is dropped).
 * @param {string} code
 * @param {{ start: number, end: number }} imp
 * @param {string} url
 */
function rewriteAssetImport(code, imp, url) {
  const start = code.lastIndexOf("import", imp.start);
  if (start < 0) return code;
  let end = imp.end;
  while (end < code.length && code[end] !== ";" && code[end] !== "\n") end++;
  if (end < code.length && code[end] === ";") end++;
  const statement = code.slice(start, end);
  const binding =
    (statement.match(/^import\s+([A-Za-z_$][\w$]*)\s+from/) || [])[1] ||
    (statement.match(/^import\s*\{\s*default\s+as\s+([A-Za-z_$][\w$]*)\s*\}/) || [])[1];
  const replacement = binding ? `const ${binding} = ${JSON.stringify(url)};` : "";
  return code.slice(0, start) + replacement + code.slice(end);
}

/**
 * @param {string} code
 * @param {{ specifier: string, kind: string, start: number, end: number }[]} imports
 * @param {string} path
 * @param {Record<string, string>|Map<string, string>|Set<string>} files
 * @param {"preview"|"publish"} mode
 * @param {Map<string, string>} [blobUrls] path -> blob URL (preview only)
 * @returns {{ code: string, missing: { from: string, specifier: string }[] }}
 */
export function rewriteSpecifiers(code, imports, path, files, mode, blobUrls) {
  /** @type {{ from: string, specifier: string }[]} */
  const missing = [];
  // Replace from the end so offsets stay valid.
  const sorted = [...imports].sort((a, b) => b.start - a.start);
  let out = code;
  for (const imp of sorted) {
    if (imp.kind === "bare") {
      // Package stylesheets (`import "swiper/css"`) are linked by the host.
      if (/(^|\/)css(\/|$)|\.css$/i.test(imp.specifier)) out = stripSideEffectImport(out, imp);
      continue;
    }
    // Stylesheets are injected separately (one <style>, foundation first).
    if (/\.(css|scss|sass|less)(\?.*)?$/i.test(imp.specifier)) {
      out = stripSideEffectImport(out, imp);
      continue;
    }
    // `import logo from "./logo.png"` becomes the file's root URL, which the
    // preview serves from the project and publish copies next to the site.
    if (ASSET_IMPORT_RE.test(imp.specifier)) {
      out = rewriteAssetImport(out, imp, assetUrl(path, imp.specifier));
      continue;
    }
    const resolved = resolveSpecifier(path, imp.specifier, files);
    if (!resolved) {
      missing.push({ from: path, specifier: imp.specifier });
      continue;
    }
    if (/\.(css|scss|sass|less)$/i.test(resolved)) {
      out = stripSideEffectImport(out, imp);
      continue;
    }
    let replacement;
    if (mode === "preview") {
      const url = blobUrls?.get(resolved);
      if (!url) {
        missing.push({ from: path, specifier: imp.specifier });
        continue;
      }
      replacement = url;
    } else {
      // Publish: relative .js path from current file
      replacement = relativeJsPath(path, resolved);
    }
    out = out.slice(0, imp.start) + replacement + out.slice(imp.end);
  }
  return { code: out, missing };
}

/**
 * Remove a whole `import "..."` / `import '...';` statement containing the specifier.
 * @param {string} code
 * @param {{ start: number, end: number }} imp
 */
function stripSideEffectImport(code, imp) {
  // Walk left to statement start, right past semicolon/newline.
  let start = imp.start;
  while (start > 0 && code[start - 1] !== "\n" && code[start - 1] !== ";") start--;
  // Prefer starting at "import"
  const importIdx = code.lastIndexOf("import", imp.start);
  if (importIdx >= 0 && importIdx >= start - 8) start = importIdx;
  let end = imp.end;
  while (end < code.length && code[end] !== ";" && code[end] !== "\n") end++;
  if (end < code.length && code[end] === ";") end++;
  if (end < code.length && code[end] === "\n") end++;
  return code.slice(0, start) + code.slice(end);
}

/**
 * @param {string} fromPath
 * @param {string} toPath
 */
function relativeJsPath(fromPath, toPath) {
  const fromDir = fromPath.includes("/")
    ? fromPath.slice(0, fromPath.lastIndexOf("/")).split("/")
    : [];
  const toJs = toPublishJsPath(toPath);
  const toParts = toJs.split("/");
  let i = 0;
  while (i < fromDir.length && i < toParts.length - 1 && fromDir[i] === toParts[i]) i++;
  const ups = fromDir.length - i;
  const down = toParts.slice(i);
  const prefix = ups === 0 ? "./" : "../".repeat(ups);
  return prefix + down.join("/");
}
