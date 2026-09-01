import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../cli-lib.mjs";

const FILES = {
  "src/main.tsx": 'import App from "./App";\nexport const x = App;',
  "src/App.tsx": 'import confetti from "canvas-confetti";\nexport default confetti;',
};

test("undeclared package is rejected with an actionable message", () => {
  const result = buildGraph(FILES, "src/main.tsx", "publish");
  assert.equal(result.ok, false);
  assert.match(result.errors[0].message, /IMPORT_NOT_IN_MANIFEST/);
});

test("package declared through extraImports resolves", () => {
  const extra = { "canvas-confetti": "https://esm.sh/canvas-confetti@^1.9.0" };
  const result = buildGraph(FILES, "src/main.tsx", "publish", extra);
  assert.equal(result.ok, true);
});

test("trailing-slash prefix allows subpath imports", () => {
  const files = {
    "src/main.tsx": 'import { fr } from "some-lib/locale";\nexport const y = fr;',
  };
  const extra = { "some-lib/": "https://esm.sh/some-lib@1.0.0/" };
  const result = buildGraph(files, "src/main.tsx", "publish", extra);
  assert.equal(result.ok, true);
});
