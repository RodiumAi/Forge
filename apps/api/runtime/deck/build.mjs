#!/usr/bin/env node
/**
 * Standalone bundle of the Forge Design deck player.
 *
 *   stdin JSON { icons?: string[], variant?: "site" | "export", minify?: boolean }
 *   --out <file>   writes the bundle, summary JSON on stdout
 *
 * The player source is the web app's `components/deck-player` (one source of
 * truth for the editor, the published page and the exports). React,
 * framer-motion and lucide-react always come from this package's own
 * node_modules, whatever the player folder sits next to, so the published
 * bundle does not depend on the web app's install.
 *
 * Only the lucide icons a deck uses are bundled: `lucide-react` is replaced by
 * a generated module that exports the icons the player's own chrome imports,
 * plus an `icons` table limited to the deck's icon names (same lookup as the
 * editor: PascalCase of the kebab name, canonical names only).
 *
 * variant "export" also bundles the layout extraction used by the PPTX export
 * (src/extract.ts); published sites never carry it.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

export const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_ICONS = 400;
// Packages the bundle takes from this folder's node_modules only.
const OWN_PACKAGES = new Set(["react", "react-dom", "framer-motion", "lucide-react", "scheduler", "motion-dom", "motion-utils"]);

/**
 * Folder of the deck player source. In the API image the Dockerfile copies it
 * to `player-src/deck-player`; in a checkout it is read from apps/web.
 */
export function playerDir() {
  const candidates = [
    process.env.FORGE_DECK_PLAYER_SRC,
    join(HERE, "player-src", "deck-player"),
    resolve(HERE, "..", "..", "..", "web", "components", "deck-player"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.ts"))) return dir;
  }
  throw new Error(`deck player source not found (looked in ${candidates.join(", ")})`);
}

export function pascalIconName(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function lucideRoot() {
  return join(HERE, "node_modules", "lucide-react", "dist", "esm");
}

/** Canonical icon names (the `icons` table) to their module file. */
export function lucideIconFiles(root = lucideRoot()) {
  const index = readFileSync(join(root, "icons", "index.mjs"), "utf8");
  const out = new Map();
  for (const m of index.matchAll(/export \{ default as (\w+) \} from '\.\/([a-z0-9-]+\.mjs)';/g)) {
    out.set(m[1], join(root, "icons", m[2]));
  }
  return out;
}

/** Every named export of lucide-react (aliases included) to its module file. */
export function lucideNamedFiles(root = lucideRoot()) {
  const main = readFileSync(join(root, "lucide-react.mjs"), "utf8");
  const out = new Map();
  for (const m of main.matchAll(/export \{([^}]+)\} from '\.\/icons\/([a-z0-9-]+\.mjs)';/g)) {
    for (const part of m[1].split(",")) {
      const alias = /default as (\w+)/.exec(part.trim());
      if (alias) out.set(alias[1], join(root, "icons", m[2]));
    }
  }
  return out;
}

/** Names the player imports from "lucide-react" (value imports only). */
export function playerLucideImports(dir) {
  const names = new Set();
  const walk = (folder) => {
    for (const entry of readdirSync(folder)) {
      const full = join(folder, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry) || /\.test\./.test(entry)) continue;
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']lucide-react["']/g)) {
        if (m[1]) continue;
        for (const part of m[2].split(",")) {
          const spec = part.trim();
          if (!spec || spec.startsWith("type ")) continue;
          names.add(spec.split(/\s+as\s+/)[0].trim());
        }
      }
    }
  };
  walk(dir);
  return names;
}

/**
 * Source of the generated `lucide-react` module: the player's chrome icons
 * and an `icons` table with the deck's icons only.
 * @param {string[]} deckIcons kebab-case names from the slides
 */
export function lucideShim(deckIcons, chromeNames, canonical = lucideIconFiles(), named = lucideNamedFiles()) {
  const lines = [];
  const found = [];
  const missing = [];
  let n = 0;
  for (const name of chromeNames) {
    if (name === "icons") continue;
    const file = named.get(name) ?? canonical.get(name);
    if (!file) throw new Error(`lucide-react has no export ${name}`);
    lines.push(`export { default as ${name} } from ${JSON.stringify(file)};`);
  }
  const table = [];
  const seen = new Set();
  for (const raw of deckIcons) {
    const name = String(raw ?? "").trim();
    if (!ICON_NAME_RE.test(name) || seen.has(name)) continue;
    seen.add(name);
    if (seen.size > MAX_ICONS) break;
    const key = pascalIconName(name);
    const file = canonical.get(key);
    if (!file) {
      missing.push(name);
      continue;
    }
    const local = `I${n++}`;
    lines.push(`import ${local} from ${JSON.stringify(file)};`);
    table.push(`${JSON.stringify(key)}: ${local}`);
    found.push(name);
  }
  lines.push(`export const icons = { ${table.join(", ")} };`);
  return { code: lines.join("\n") + "\n", found, missing };
}

function isBare(spec) {
  return !spec.startsWith(".") && !spec.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(spec);
}

function packageName(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * @param {{ icons?: string[], variant?: "site" | "export", minify?: boolean, outfile?: string }} options
 */
export async function buildDeckBundle({ icons = [], variant = "site", minify = true, outfile } = {}) {
  const dir = playerDir();
  const chrome = playerLucideImports(dir);
  const shim = lucideShim(icons, chrome);
  const plugin = {
    name: "forge-deck",
    setup(build) {
      build.onResolve({ filter: /^@forge\/deck-player(\/.*)?$/ }, (args) => {
        const sub = args.path.slice("@forge/deck-player".length).replace(/^\//, "");
        const base = join(dir, sub || "index");
        for (const ext of [".ts", ".tsx"]) {
          if (existsSync(base + ext)) return { path: base + ext };
        }
        return { errors: [{ text: `unknown deck player module ${args.path}` }] };
      });
      build.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "lucide-react", namespace: "forge-lucide" }));
      build.onLoad({ filter: /.*/, namespace: "forge-lucide" }, () => ({ contents: shim.code, loader: "js", resolveDir: HERE }));
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData?.forgeOwn || !isBare(args.path) || !OWN_PACKAGES.has(packageName(args.path))) return undefined;
        if (args.importer && args.importer.startsWith(join(HERE, "node_modules"))) return undefined;
        const result = await build.resolve(args.path, { resolveDir: HERE, kind: args.kind, pluginData: { forgeOwn: true } });
        if (result.errors.length) return { errors: result.errors };
        return { path: result.path, sideEffects: result.sideEffects };
      });
    },
  };
  const result = await esbuild.build({
    entryPoints: [join(HERE, "src", "entry.tsx")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    minify,
    write: false,
    legalComments: "none",
    tsconfigRaw: "{}",
    logLevel: "silent",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __FORGE_EXPORT__: variant === "export" ? "true" : "false",
    },
    plugins: [plugin],
  });
  const code = result.outputFiles[0].text;
  if (outfile) writeFileSync(outfile, code);
  return { code, icons: shim.found, missingIcons: shim.missing, warnings: result.warnings.map((w) => w.text) };
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outfile = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (!outfile) throw new Error("usage: build.mjs --out <file> < options.json");
  const raw = readFileSync(0, "utf8");
  const options = raw.trim() ? JSON.parse(raw) : {};
  const out = await buildDeckBundle({ ...options, outfile });
  process.stdout.write(
    JSON.stringify({ ok: true, bytes: Buffer.byteLength(out.code), icons: out.icons, missingIcons: out.missingIcons }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stdout.write(JSON.stringify({ ok: false, error: String(err?.message ?? err).slice(0, 4000) }));
    process.exitCode = 1;
  });
}
