import assert from "node:assert/strict";
import { test } from "node:test";
import { collectNamedImports, checkNamedExports } from "../export_check.mjs";

test("collectNamedImports parses lucide named imports", () => {
  const src = `import { MessageSquareCheck, ArrowRight } from "lucide-react";\n`;
  const imports = collectNamedImports(src, "src/App.tsx");
  assert.equal(imports.length, 1);
  assert.deepEqual(imports[0].names, ["MessageSquareCheck", "ArrowRight"]);
  assert.equal(imports[0].specifier, "lucide-react");
});

test("collectNamedImports skips type-only imports", () => {
  const src = `import type { LucideIcon } from "lucide-react";\n`;
  assert.equal(collectNamedImports(src, "src/App.tsx").length, 0);
});

test("checkNamedExports flags MessageSquareCheck", async () => {
  const files = {
    "src/main.tsx": `import { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")).render(<App />);`,
    "src/App.tsx": `import { MessageSquareCheck } from "lucide-react";\nexport default function App() { return <MessageSquareCheck />; }`,
  };
  const errors = await checkNamedExports(files);
  assert.ok(errors.length > 0);
  assert.match(errors[0].message, /EXPORT_NOT_FOUND: lucide-react\.MessageSquareCheck/);
  assert.match(errors[0].message, /MessageSquare/);
});

test("checkNamedExports accepts MessageSquare", async () => {
  const files = {
    "src/App.tsx": `import { MessageSquare } from "lucide-react";\nexport default function App() { return <MessageSquare />; }`,
  };
  const errors = await checkNamedExports(files);
  assert.equal(errors.length, 0);
});
