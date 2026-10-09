#!/usr/bin/env node
/**
 * Publish-side build.
 *
 *   stdin JSON { files, entry, indexHtml, extraImports, assetPaths, lang, title }
 *   --check            smoke-transform + named export resolution (verify pass)
 *   --out-dir <dir>    production build written to <dir>, summary JSON on stdout
 *
 * The check path keeps the per-file graph of the preview (same Babel
 * transform, same resolver). The production build bundles, minifies and
 * hashes through esbuild (see build.mjs).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import { buildSite, fetchCdn } from "./build.mjs";
import { buildGraph, extractSeoHead } from "./cli-lib.mjs";
import { assembleCss, isFontStylesheet } from "./css.mjs";
import { checkNamedExports } from "./export_check.mjs";

function readStdin() {
  return readFileSync(0, "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Stylesheet of the published page: every project stylesheet (foundation
 * first) plus package stylesheets, minified. Web-font imports become <link>
 * tags with preconnect hints instead of a render-blocking @import.
 * @param {Record<string, string>} files
 * @param {string[]} packageCss CDN stylesheet URLs (`swiper/css`...)
 */
async function buildStyles(files, packageCss) {
  const assembled = assembleCss(files);
  const fontLinks = [];
  const keptImports = [];
  for (const imp of assembled.imports) {
    if (isFontStylesheet(imp.url) && !imp.media) fontLinks.push(imp.url);
    else keptImports.push(`@import url("${imp.url}")${imp.media ? " " + imp.media : ""};`);
  }
  const packageSheets = [];
  const packageLinks = [];
  for (const url of packageCss) {
    try {
      packageSheets.push(await fetchCdn(url));
    } catch {
      packageLinks.push(url);
    }
  }
  const raw = [...keptImports, ...packageSheets, assembled.css].join("\n");
  let css = raw;
  try {
    css = (await esbuild.transform(raw, { loader: "css", minify: true, legalComments: "none" })).code;
  } catch {
    /* invalid CSS: ship it as written rather than fail the publish */
  }
  const head = [];
  if (fontLinks.length) {
    const origins = new Set(fontLinks.map((u) => new URL(u).origin));
    for (const origin of origins) head.push(`<link rel="preconnect" href="${origin}" />`);
    if ([...origins].some((o) => o.includes("googleapis"))) {
      head.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
    }
    for (const url of fontLinks) head.push(`<link rel="stylesheet" href="${escapeHtml(url)}" />`);
  }
  for (const url of packageLinks) head.push(`<link rel="stylesheet" href="${escapeHtml(url)}" />`);
  return { css, head };
}

async function main() {
  const args = process.argv.slice(2);
  const outDirIdx = args.indexOf("--out-dir");
  const outDir = outDirIdx >= 0 ? args[outDirIdx + 1] : null;

  let payload;
  try {
    payload = JSON.parse(readStdin());
  } catch {
    console.error(JSON.stringify({ ok: false, errors: [{ message: "Invalid JSON stdin" }] }));
    process.exit(1);
  }

  const files = payload.files || {};
  const entry = payload.entry || "src/main.tsx";
  const extraImports = payload.extraImports || {};

  if (args.includes("--check")) {
    const result = buildGraph(files, entry, "publish", extraImports);
    if (!result.ok) {
      process.stdout.write(JSON.stringify({ ok: false, errors: result.errors || [] }));
      return;
    }
    const exportErrors = await checkNamedExports(files, extraImports);
    if (exportErrors.length) {
      process.stdout.write(JSON.stringify({ ok: false, errors: [...(result.errors || []), ...exportErrors] }));
      return;
    }
    process.stdout.write(JSON.stringify({ ok: true, errors: [] }));
    return;
  }

  if (!outDir) {
    process.stdout.write(JSON.stringify({ ok: false, errors: [{ message: "--out-dir is required" }] }));
    process.exit(2);
  }

  const build = await buildSite({
    files,
    entry,
    extraImports,
    assetPaths: payload.assetPaths || [],
  });
  if (!build.ok) {
    process.stdout.write(JSON.stringify({ ok: false, errors: build.errors }));
    process.exit(2);
  }

  // The published head inherits the project's SEO (title, description, og/
  // twitter metas, favicon, canonical, structured data, analytics snippets)
  // written into the project index.html.
  const seo = extractSeoHead(payload.indexHtml || files["index.html"] || "");
  const title = seo.title || payload.title || "Forge app";
  const seoTags = seo.tags.join("\n");
  const hasIcon = /rel=["'][^"']*icon/i.test(seoTags);
  const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(payload.lang || "") ? payload.lang : "en";
  const styles = await buildStyles(files, build.cssImports || []);

  const importMap =
    build.mode === "external" && Object.keys(build.importMap).length
      ? `<script type="importmap">${JSON.stringify({ imports: build.importMap })}</script>\n`
      : "";
  const preload = build.preload.map((p) => `<link rel="modulepreload" href="/${p}" />`).join("\n");

  const indexHtml = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${hasIcon ? "" : '<link rel="icon" type="image/png" href="/favicon.png" />\n'}${seoTags ? seoTags + "\n" : ""}${styles.head.join("\n")}
${importMap}<link rel="modulepreload" href="/${build.entryFile}" />
${preload}
<style>${styles.css}</style>
<!--forge:head-->
</head>
<body>
<div id="root"></div>
<script type="module" src="/${build.entryFile}"></script>
<!--forge:body-->
</body>
</html>
`;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), indexHtml, "utf8");
  for (const out of build.outputs) {
    const full = join(outDir, out.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, out.contents, "utf8");
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      mode: build.mode,
      entry: build.entryFile,
      files: build.outputs.map((o) => o.path),
      assets: build.assets,
      outDir,
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, errors: [{ message: String(e?.message || e) }] }));
  process.exit(1);
});
