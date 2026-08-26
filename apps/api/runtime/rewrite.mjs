/**
 * Rewrite import/export specifiers after transform.
 */

import { resolveSpecifier, toPublishJsPath } from "./resolve.mjs";

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
    if (imp.kind === "bare") continue;
    // Side-effect CSS/asset imports are injected separately (style tag / public/).
    if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|eot)(\?.*)?$/i.test(imp.specifier)) {
      out = stripSideEffectImport(out, imp);
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
