// Self-hosts the Monaco editor runtime under /monaco-vs.
//
// @monaco-editor/react loads Monaco from cdn.jsdelivr.net by default. Our CSP
// only allows 'self' scripts, so that request was blocked and the code editor
// never rendered. Serving it from our own origin also avoids sending every
// editor user's IP to a third-party CDN.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "monaco-editor", "min", "vs");
const target = join(root, "public", "monaco-vs");
const marker = join(target, ".monaco-version");

if (!existsSync(source)) {
  console.error(
    "copy-monaco: node_modules/monaco-editor/min/vs not found. Run `npm ci` first.",
  );
  process.exit(1);
}

const { version } = JSON.parse(
  readFileSync(join(root, "node_modules", "monaco-editor", "package.json"), "utf8"),
);

if (existsSync(marker) && readFileSync(marker, "utf8").trim() === version) {
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
writeFileSync(marker, `${version}\n`);
console.log(`copy-monaco: monaco-editor ${version} copied to public/monaco-vs`);
