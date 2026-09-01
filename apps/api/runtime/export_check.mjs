/**
 * Validate named imports against real package exports.
 * lucide-react uses a frozen list (lucide_exports.json); other manifest
 * browser packages are checked via local node_modules when available.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @type {Set<string>|null} */
let lucideExports = null;

function loadLucideExports() {
  if (lucideExports) return lucideExports;
  const raw = readFileSync(join(__dirname, "lucide_exports.json"), "utf8");
  lucideExports = new Set(JSON.parse(raw));
  return lucideExports;
}

/** @type {Record<string, {version: string, browser?: boolean, peerReact?: boolean, subpaths?: string[]}>} */
const MANIFEST = require("./packages.json").packages;

const PKG_NAME_RE = /^((?:@[^/]+\/)?[^/]+)/;

/**
 * @param {string} specifier
 */
function barePackage(specifier) {
  const m = PKG_NAME_RE.exec(specifier || "");
  return m ? m[1] : specifier;
}

/**
 * Parse named imports: `import { Foo, Bar as Baz } from "pkg"`
 * Skips `import type { ... }`.
 * @param {string} source
 * @returns {Array<{ names: string[], specifier: string, path: string, line: number }>}
 */
export function collectNamedImports(source, path = "") {
  /** @type {Array<{ names: string[], specifier: string, path: string, line: number }>} */
  const out = [];
  const lines = source.split("\n");
  const importRe =
    /^\s*import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+["']([^"']+)["']/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*import\s+type\s/.test(line)) continue;
    const m = importRe.exec(line);
    if (!m) continue;
    const specifier = m[1];
    const braceMatch = line.match(/\{([^}]+)\}/);
    if (!braceMatch) continue;
    const names = braceMatch[1]
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed || trimmed.startsWith("type ")) return "";
        const alias = trimmed.split(/\s+as\s+/i);
        return (alias[1] || alias[0]).trim();
      })
      .filter((n) => n && /^[A-Za-z_$]/.test(n));
    if (names.length) {
      out.push({ names, specifier, path, line: i + 1 });
    }
  }
  return out;
}

/**
 * @param {string} missing
 * @param {Set<string>} available
 */
function suggestExport(missing, available) {
  const lower = missing.toLowerCase();
  const candidates = [...available].filter((name) => {
    const nl = name.toLowerCase();
    return nl.includes(lower) || lower.includes(nl) || nl.startsWith(lower.slice(0, 4));
  });
  candidates.sort((a, b) => {
    const da = levenshtein(missing.toLowerCase(), a.toLowerCase());
    const db = levenshtein(missing.toLowerCase(), b.toLowerCase());
    return da - db;
  });
  return candidates[0] || null;
}

/**
 * @param {string} a
 * @param {string} b
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  /** @type {number[][]} */
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** @type {Map<string, Set<string>>} */
const moduleCache = new Map();

/**
 * @param {string} pkg
 */
async function resolvePackageExports(pkg) {
  if (moduleCache.has(pkg)) return moduleCache.get(pkg);
  if (pkg === "lucide-react") {
    const set = loadLucideExports();
    moduleCache.set(pkg, set);
    return set;
  }
  const spec = MANIFEST[pkg];
  if (!spec?.browser) return null;

  try {
    const entry = require.resolve(pkg);
    const mod = await import(pathToFileURL(entry).href);
    const names = new Set(
      Object.keys(mod).filter((k) => k !== "default" && /^[A-Za-z_$]/.test(k)),
    );
    moduleCache.set(pkg, names);
    return names;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string>} files
 * @param {Record<string, string>} [_extraImports]
 * @returns {Promise<Array<{ path: string, message: string, line?: number }>>}
 */
export async function checkNamedExports(files, _extraImports = {}) {
  /** @type {Map<string, Array<{ path: string, line: number, name: string }>>} */
  const byPkg = new Map();

  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(path)) continue;
    if (path.includes("vite.config") || path.includes("node_modules")) continue;
    for (const imp of collectNamedImports(content, path)) {
      const pkg = barePackage(imp.specifier);
      if (!pkg || !(pkg in MANIFEST) || !MANIFEST[pkg].browser) continue;
      if (imp.specifier.includes("/") && imp.specifier !== pkg) {
        // subpath import — skip named export validation for now
        const sub = imp.specifier.slice(pkg.length + 1);
        if (sub && !(MANIFEST[pkg].subpaths || []).includes(sub)) continue;
      }
      for (const name of imp.names) {
        if (name === "React" && (pkg === "react" || pkg === "react-dom")) continue;
        const list = byPkg.get(pkg) || [];
        list.push({ path: imp.path, line: imp.line, name });
        byPkg.set(pkg, list);
      }
    }
  }

  /** @type {Array<{ path: string, message: string, line?: number }>} */
  const errors = [];

  for (const [pkg, imports] of byPkg) {
    const exports = await resolvePackageExports(pkg);
    if (!exports) continue;
    for (const { path, line, name } of imports) {
      if (exports.has(name)) continue;
      let message = `EXPORT_NOT_FOUND: ${pkg}.${name}`;
      if (pkg === "lucide-react") {
        const suggestion = suggestExport(name, exports);
        if (suggestion) {
          message += ` — try "${suggestion}" instead (lucide-react@0.468.0)`;
        } else {
          message += " — use an icon that exists in lucide-react@0.468.0";
        }
      }
      errors.push({ path, line, message });
      if (errors.length >= 20) return errors;
    }
  }

  return errors;
}
