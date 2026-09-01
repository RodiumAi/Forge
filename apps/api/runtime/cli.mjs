#!/usr/bin/env node
/**
 * Publish-side transform: stdin JSON { files, entry } → stdout JSON { ok, modules, errors }
 * Same Babel transform as the browser runner.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildGraph, extractSeoHead } from "./cli-lib.mjs";
import { checkNamedExports } from "./export_check.mjs";
import { importMapScriptTag } from "./importmap.mjs";

function readStdin() {
  return readFileSync(0, "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const outDirIdx = args.indexOf("--out-dir");
  const outDir = outDirIdx >= 0 ? args[outDirIdx + 1] : null;

  let payload;
  try {
    payload = JSON.parse(readStdin());
  } catch (e) {
    console.error(JSON.stringify({ ok: false, errors: [{ message: "Invalid JSON stdin" }] }));
    process.exit(1);
  }

  const files = payload.files || {};
  const entry = payload.entry || "src/main.tsx";
  const extraImports = payload.extraImports || {};
  const css = files["src/index.css"] || files["index.css"] || "";
  const result = buildGraph(files, entry, "publish", extraImports);

  // --check: smoke-transform + named export resolution (post-plan self-verification).
  // Reports syntax, MODULE_NOT_FOUND, imports outside the map, and missing
  // named exports (e.g. lucide-react icons that do not exist in 0.468.0).
  if (args.includes("--check")) {
    if (!result.ok) {
      process.stdout.write(JSON.stringify({ ok: false, errors: result.errors || [] }));
      return;
    }
    const exportErrors = await checkNamedExports(files, extraImports);
    if (exportErrors.length) {
      process.stdout.write(
        JSON.stringify({ ok: false, errors: [...(result.errors || []), ...exportErrors] }),
      );
      return;
    }
    process.stdout.write(JSON.stringify({ ok: true, errors: [] }));
    return;
  }

  if (!result.ok) {
    process.stdout.write(JSON.stringify({ ok: false, errors: result.errors }));
    process.exit(2);
  }

  // The published head inherits the project's SEO (title, description, og/
  // twitter metas, favicon, canonical) written by the SEO editor into the
  // project index.html — instead of a hardcoded "Forge app" shell.
  const seo = extractSeoHead(payload.indexHtml || files["index.html"] || "");
  const title = seo.title || payload.title || "Forge app";
  const seoTags = seo.tags.join("\n");
  const hasIcon = /rel=["'][^"']*icon/i.test(seoTags);

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${hasIcon ? "" : '<link rel="icon" type="image/png" href="/favicon.png" />\n'}${seoTags ? seoTags + "\n" : ""}${importMapScriptTag(extraImports)}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/${result.entryUrl}"></script>
</body>
</html>
`;

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), indexHtml, "utf8");
    for (const [path, code] of Object.entries(result.modules || {})) {
      const full = join(outDir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, code, "utf8");
    }
    // Copy public assets as-is if provided as files with public/ prefix (binary skipped in JSON)
    process.stdout.write(
      JSON.stringify({
        ok: true,
        entry: result.entryUrl,
        files: Object.keys(result.modules || {}),
        outDir,
      }),
    );
    return;
  }

  process.stdout.write(
    JSON.stringify({
      ok: true,
      entry: result.entryUrl,
      modules: result.modules,
      indexHtml,
    }),
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, errors: [{ message: String(e?.message || e) }] }));
  process.exit(1);
});
