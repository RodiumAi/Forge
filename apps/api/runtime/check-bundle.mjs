import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { transform } from "./transform.mjs";

const root = process.argv[2];
if (!root) {
  console.error("usage: node check-bundle.mjs <projectRoot>");
  process.exit(1);
}

function walk(dir, base = "") {
  const out = {};
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(p).isDirectory()) Object.assign(out, walk(p, rel));
    else if (/\.(tsx|ts|jsx|js|css)$/.test(name)) out[rel.replace(/\\/g, "/")] = readFileSync(p, "utf8");
  }
  return out;
}

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
function normalizeJoin(fromDir, specifier) {
  const parts = [...fromDir.split("/").filter(Boolean), ...specifier.split("/")];
  const stack = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}
function resolveSpecifier(fromPath, specifier, files) {
  let base;
  if (specifier.startsWith("@/")) base = "src/" + specifier.slice(2);
  else if (specifier.startsWith("/")) base = specifier.replace(/^\//, "");
  else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
    base = normalizeJoin(fromDir, specifier);
  } else return null;
  if (Object.prototype.hasOwnProperty.call(files, base)) return base;
  for (const ext of EXTENSIONS) {
    if (Object.prototype.hasOwnProperty.call(files, base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const c = base.replace(/\/$/, "") + "/index" + ext;
    if (Object.prototype.hasOwnProperty.call(files, c)) return c;
  }
  return null;
}

const files = walk(join(root, "src"), "src");
const missing = [];
const transformErrors = [];
for (const [path, code] of Object.entries(files)) {
  if (!/\.(tsx|ts|jsx|js)$/.test(path)) continue;
  const r = transform(code, path);
  if (r.error) {
    transformErrors.push(r.error);
    continue;
  }
  for (const imp of r.imports || []) {
    if (imp.kind === "bare") continue;
    if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|eot)(\?.*)?$/i.test(imp.specifier)) {
      const resolved = resolveSpecifier(path, imp.specifier, files);
      if (!resolved) missing.push({ from: path, specifier: imp.specifier, kind: "css-asset-missing-file" });
      continue;
    }
    const resolved = resolveSpecifier(path, imp.specifier, files);
    if (!resolved) missing.push({ from: path, specifier: imp.specifier, kind: "module" });
  }
}
console.log(JSON.stringify({ fileCount: Object.keys(files).length, transformErrors, missing }, null, 2));
