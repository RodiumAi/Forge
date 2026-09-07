#!/usr/bin/env node
/**
 * Keep runtime/public/babel.min.js in sync with @babel/standalone.
 * The preview iframe loads /runner/babel.min.js; the vendor blob is not
 * committed, so local compose (volume-mounted public/) and Docker builds
 * both need this copy step.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@babel", "standalone", "babel.min.js");
const destDir = join(root, "public");
const dest = join(destDir, "babel.min.js");

if (!existsSync(src)) {
  console.error(`[forge-runtime] missing ${src} — run npm ci in apps/api/runtime`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
const size = statSync(dest).size;
if (size < 100_000) {
  console.error(`[forge-runtime] babel.min.js looks too small (${size} bytes)`);
  process.exit(1);
}
console.log(`[forge-runtime] wrote public/babel.min.js (${size} bytes)`);
