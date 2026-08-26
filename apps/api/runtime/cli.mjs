#!/usr/bin/env node
/**
 * Publish-side transform: stdin JSON { files, entry } → stdout JSON { ok, modules, errors }
 * Same Babel transform as the browser runner.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildGraph } from "./cli-lib.mjs";
import { importMapScriptTag } from "./importmap.mjs";

function readStdin() {
  return readFileSync(0, "utf8");
}

function main() {
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
  const css = files["src/index.css"] || files["index.css"] || "";
  const result = buildGraph(files, entry, "publish");

  if (!result.ok) {
    process.stdout.write(JSON.stringify({ ok: false, errors: result.errors }));
    process.exit(2);
  }

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(payload.title || "Forge app")}</title>
<link rel="icon" type="image/png" href="/favicon.png" />
${importMapScriptTag()}
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

main();
