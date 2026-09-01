import assert from "node:assert/strict";
import { test } from "node:test";
import { transform, collectImports } from "../transform.mjs";
import { resolveSpecifier, toPublishJsPath } from "../resolve.mjs";
import { topoSort } from "../topo.mjs";
import { rewriteSpecifiers } from "../rewrite.mjs";
import { buildGraph } from "../cli-lib.mjs";

test("transform TSX emits jsx-runtime import", () => {
  const src = `export function Hi() { return <div className="x">hi</div>; }\n`;
  const r = transform(src, "src/Hi.tsx");
  assert.equal(r.error, null);
  assert.match(r.code, /jsx-runtime|jsx\s*\(/);
});

test("resolve is case-sensitive", () => {
  const files = { "src/components/Button.tsx": "" };
  assert.equal(
    resolveSpecifier("src/App.tsx", "./components/Button", files),
    "src/components/Button.tsx",
  );
  assert.equal(
    resolveSpecifier("src/App.tsx", "./components/button", files),
    null,
  );
});

test("resolve @/ alias", () => {
  const files = { "src/components/Hero.tsx": "" };
  assert.equal(
    resolveSpecifier("src/pages/Home.tsx", "@/components/Hero", files),
    "src/components/Hero.tsx",
  );
});

test("topo detects cycles", () => {
  const files = new Set(["a.tsx", "b.tsx"]);
  const transformed = new Map([
    ["a.tsx", { imports: [{ specifier: "./b", kind: "relative" }] }],
    ["b.tsx", { imports: [{ specifier: "./a", kind: "relative" }] }],
  ]);
  assert.throws(() => topoSort(transformed, files), /CIRCULAR_DEPENDENCY/);
});

test("buildGraph publish rewrites to .js", () => {
  const files = {
    "src/main.tsx": `import { App } from "./App";\nimport { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`,
    "src/App.tsx": `export function App() { return <h1>Ok</h1>; }\n`,
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.modules["src/main.js"]);
  assert.ok(r.modules["src/App.js"]);
  assert.match(r.modules["src/main.js"], /\.\/App\.js/);
});

test("MODULE_NOT_FOUND on missing import", () => {
  const files = {
    "src/main.tsx": `import { App } from "./Missing";\nexport function boot() { return <App />; }\n`,
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.match(r.errors[0].message, /MODULE_NOT_FOUND/);
});

test("toPublishJsPath", () => {
  assert.equal(toPublishJsPath("src/App.tsx"), "src/App.js");
});

test("collectImports finds bare and relative", () => {
  const code = `import React from "react";\nimport { X } from "./X.js";\n`;
  const imps = collectImports(code);
  assert.ok(imps.some((i) => i.specifier === "react" && i.kind === "bare"));
  assert.ok(imps.some((i) => i.specifier === "./X.js" && i.kind === "relative"));
});

test("IMPORT_NOT_IN_MANIFEST rejects unknown bare package", () => {
  const files = {
    "src/main.tsx": `import lodash from "lodash";\nexport const x = lodash;\n`,
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /IMPORT_NOT_IN_MANIFEST/);
});

test("CSS side-effect imports are stripped", () => {
  const files = {
    "src/main.tsx": `import { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`,
    "src/App.tsx": `export default function App() { return <h1>Ok</h1>; }\n`,
    "src/index.css": `h1 { color: red; }\n`,
  };
  const r = buildGraph(files, "src/main.tsx", "publish");
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.doesNotMatch(r.modules["src/main.js"], /index\.css/);
});
