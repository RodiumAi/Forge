import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSite } from "../build.mjs";
import { buildGraph, extractSeoHead } from "../cli-lib.mjs";
import { assembleCss } from "../css.mjs";
import { transform } from "../transform.mjs";

test("web-font @import is hoisted out of any stylesheet, ';' in the URL kept", () => {
  const out = assembleCss({
    "src/styles/home.css": '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap");\n.home-screen .x { color: red; }',
    "src/index.css": ":root { --bg: #fff; }",
  });
  assert.deepEqual(out.imports, [
    { url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap", media: "" },
  ]);
  assert.ok(!out.css.includes("@import"));
  assert.ok(out.css.indexOf(":root") < out.css.indexOf(".home-screen"), "foundation first");
});

test("asset imports become root URLs instead of disappearing", () => {
  const files = {
    "src/main.tsx": 'import logo from "./assets/logo.png";\nexport const src = logo;',
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, true);
  assert.match(r.modules["src/main.js"], /const logo = "\/src\/assets\/logo\.png";/);
});

test("package stylesheets pass the import check", () => {
  const files = {
    "src/main.tsx": 'import "swiper/css";\nexport const ok = true;',
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(!r.modules["src/main.js"].includes("swiper/css"));
});

test("production transform: lazy images, no inline source maps", () => {
  const code = 'export const A = () => <><img src="/a.png" alt="" /><img src="/h.png" fetchPriority="high" alt="" /></>;';
  const prod = transform(code, "src/A.tsx", { production: true });
  assert.equal(prod.error, null);
  assert.ok(!prod.code.includes("sourceMappingURL"));
  assert.equal((prod.code.match(/loading: "lazy"/g) || []).length, 1, "the hero image stays eager");
  const preview = transform(code, "src/A.tsx");
  assert.ok(preview.code.includes("sourceMappingURL=data:"), "preview keeps debuggable maps");
});

test("published head keeps structured data and remote stylesheets, not the preview wiring", () => {
  const head = extractSeoHead(
    '<html><head><title>T</title><script type="application/ld+json">{"a":1}</script>' +
      '<script type="importmap">{}</script><script type="module" src="/src/main.js"></script>' +
      '<link rel="stylesheet" href="/src/index.css" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /></head></html>',
  );
  const all = head.tags.join("\n");
  assert.ok(all.includes("application/ld+json"));
  assert.ok(all.includes("fonts.googleapis.com"));
  assert.ok(all.includes("preconnect"));
  assert.ok(!all.includes("importmap"));
  assert.ok(!all.includes("/src/main.js"));
  assert.ok(!all.includes("/src/index.css"));
});

test("build without the CDN: minified, hashed, import map limited to what is used", async () => {
  const files = {
    "src/main.tsx": 'import { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")).render(<App />);',
    "src/App.tsx": 'import { useState } from "react";\nexport default function App() { const [n] = useState(1); return <p>{n}</p>; }',
  };
  const r = await buildSite({ files, entry: "src/main.tsx", external: true });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.mode, "external");
  assert.match(r.entryFile, /^assets\/main-[A-Z0-9]+\.js$/);
  assert.deepEqual(Object.keys(r.importMap).sort(), ["react", "react-dom/client", "react/jsx-runtime"]);
  const entry = r.outputs.find((o) => o.path === r.entryFile);
  assert.ok(!entry.contents.includes("\n  "), "minified");
});

test("build reports a missing local module", async () => {
  const r = await buildSite({
    files: { "src/main.tsx": 'import X from "./Missing";\nexport default X;' },
    entry: "src/main.tsx",
    external: true,
  });
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /MODULE_NOT_FOUND/);
});
