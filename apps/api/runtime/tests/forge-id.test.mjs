import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildSite } from "../build.mjs";
import { transform } from "../transform.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function idsIn(code) {
  return [...code.matchAll(/"data-forge-id": "([^"]+)"/g)].map((m) => m[1]);
}

test("preview transform tags host elements with file:line:col", () => {
  const src = [
    "export function Hero() {",
    "  return (",
    '    <section className="hero">',
    "      <h1>Hello</h1>",
    "      <Button label=\"go\" />",
    "      <svg><path d=\"M0 0\" /></svg>",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n");
  const r = transform(src, "src/components/Hero.tsx", { forgeIds: true });
  assert.equal(r.error, null);
  assert.deepEqual(idsIn(r.code), [
    "src/components/Hero.tsx:3:5",
    "src/components/Hero.tsx:4:7",
    "src/components/Hero.tsx:6:7",
    "src/components/Hero.tsx:6:12",
  ]);
  // Components (capitalised) never get an id: it would land on their props.
  assert.match(r.code, /jsx\(Button, \{\s*label: "go"\s*\}\)/);
});

test("a hand-written data-forge-id is replaced by the real location", () => {
  const src = 'export const A = () => <p data-forge-id="src/Other.tsx:9:9">x</p>;\n';
  const r = transform(src, "src/A.tsx", { forgeIds: true });
  assert.deepEqual(idsIn(r.code), ["src/A.tsx:1:24"]);
});

test("react-three-fiber files and unknown lowercase tags are left alone", () => {
  const r3f = [
    'import { Canvas } from "@react-three/fiber";',
    "export const S = () => <Canvas><mesh><boxGeometry /></mesh><div /></Canvas>;",
    "",
  ].join("\n");
  assert.deepEqual(idsIn(transform(r3f, "src/S.tsx", { forgeIds: true }).code), []);
  const other = "export const M = () => <group><mesh /></group>;\n";
  assert.deepEqual(idsIn(transform(other, "src/M.tsx", { forgeIds: true }).code), []);
});

test("ids are off by default and stripped from production builds", () => {
  const src = 'export const A = () => <div data-forge-id="src/A.tsx:1:24"><span>x</span></div>;\n';
  assert.deepEqual(idsIn(transform("export const A = () => <div />;\n", "src/A.tsx").code), []);
  const prod = transform(src, "src/A.tsx", { production: true, forgeIds: true });
  assert.equal(prod.error, null);
  assert.ok(!prod.code.includes("data-forge-id"), prod.code);
});

test("published bundle carries no preview id", async () => {
  const files = {
    "src/main.tsx": 'import { App } from "./App";\nexport const root = <App />;\n',
    "src/App.tsx": 'export function App() { return <main data-forge-id="src/App.tsx:1:33"><h1>Ok</h1></main>; }\n',
  };
  const r = await buildSite({ files, entry: "src/main.tsx", external: true });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  for (const out of r.outputs) assert.ok(!String(out.contents).includes("data-forge-id"), out.path);
});

test("the runner copy of the plugin is identical to transform.mjs", () => {
  const block = (text) => {
    const start = text.indexOf("// forge-id-plugin:start");
    const end = text.indexOf("// forge-id-plugin:end");
    assert.ok(start >= 0 && end > start, "markers present");
    return text.slice(start, end).replace(/\r\n/g, "\n");
  };
  const runner = readFileSync(join(root, "public", "runner.js"), "utf8");
  const shared = readFileSync(join(root, "transform.mjs"), "utf8");
  assert.equal(block(runner), block(shared));
  assert.match(runner, /\[forgeIdPreviewPlugin, \{ file: path \}\]/, "the preview runner applies it");
});
