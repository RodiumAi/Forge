/**
 * Forge preview runner — runs inside an origin separate from the Forge UI.
 * Receives files via postMessage, transforms with Babel standalone, mounts via Blob URLs.
 */

const ALLOWED_PARENT_ORIGINS = new Set(
  (window.__FORGE_PARENT_ORIGINS || "http://localhost:3100,http://127.0.0.1:3100")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin) {
  // Strict allowlist only. Accepting any localhost port let a rogue local page
  // register itself, and `send()` then broadcast app content to it.
  return ALLOWED_PARENT_ORIGINS.has(origin);
}

// The embedder is the only peer we talk to. Derived from the referrer, kept
// only if allowed, and never widened at runtime.
let PARENT_ORIGIN = (() => {
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : "";
    return isAllowedOrigin(ref) ? ref : "";
  } catch {
    return "";
  }
})();

const send = (payload) => {
  if (!PARENT_ORIGIN) return;
  try {
    parent.postMessage(payload, PARENT_ORIGIN);
  } catch {
    /* ignore */
  }
};

window.onerror = (message, source, line, column, error) => {
  send({
    type: "forge:error",
    kind: "runtime",
    message: String(message),
    source,
    line,
    column,
    stack: error?.stack,
  });
  return false;
};

window.addEventListener("unhandledrejection", (e) => {
  send({
    type: "forge:error",
    kind: "rejection",
    message: String(e.reason),
    stack: e.reason?.stack,
  });
});

["log", "info", "warn", "error"].forEach((level) => {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    try {
      send({
        type: "forge:console",
        level,
        args: args.map((a) => {
          try {
            return typeof a === "string" ? a : JSON.stringify(a);
          } catch {
            return String(a);
          }
        }),
      });
    } catch {
      /* ignore */
    }
    original(...args);
  };
});

const PRESETS = [
  ["react", { runtime: "automatic" }],
  ["typescript", { isTSX: true, allExtensions: true }],
];

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const STATEMENT_IMPORT_RES = [
  /\bimport\s*["']([^"']+)["']\s*;?/g,
  /\bimport\s+(?:type\s+)?[\s\S]*?\s+from\s*["']([^"']+)["']/g,
  /\bexport\s+[\s\S]*?\s+from\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']/g,
];

function classifySpecifier(specifier) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return "relative";
  if (specifier.startsWith("@/") || specifier.startsWith("/")) return "alias";
  return "bare";
}

function collectImports(code) {
  const out = [];
  const seen = new Set();
  for (const pattern of STATEMENT_IMPORT_RES) {
    const re = new RegExp(pattern.source, "g");
    let m;
    while ((m = re.exec(code))) {
      const specifier = m[1];
      if (!specifier) continue;
      const absStart = m.index + m[0].lastIndexOf(specifier);
      const key = `${absStart}:${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        specifier,
        kind: classifySpecifier(specifier),
        start: absStart,
        end: absStart + specifier.length,
      });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function transform(code, path) {
  try {
    const out = Babel.transform(code, {
      filename: path,
      presets: PRESETS,
      sourceMaps: "inline",
      compact: false,
      configFile: false,
      babelrc: false,
    });
    const js = out.code || "";
    return { code: js, imports: collectImports(js), error: null };
  } catch (e) {
    return {
      code: "",
      imports: [],
      error: {
        path,
        message: String(e?.message || e),
        line: e?.loc?.line,
        column: e?.loc?.column,
      },
    };
  }
}

function normalizeJoin(dir, rel) {
  const parts = (dir ? dir.split("/") : []).concat(rel.split("/"));
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

function topoSort(transformed, files) {
  const graph = new Map();
  for (const [path, info] of transformed) {
    const deps = [];
    for (const imp of info.imports || []) {
      if (imp.kind === "bare") continue;
      const resolved = resolveSpecifier(path, imp.specifier, files);
      if (resolved && transformed.has(resolved)) deps.push(resolved);
    }
    graph.set(path, deps);
  }
  const order = [];
  const visited = new Set();
  const stack = new Set();
  const trail = [];
  function visit(node) {
    if (visited.has(node)) return;
    if (stack.has(node)) {
      const idx = trail.indexOf(node);
      throw new Error(`CIRCULAR_DEPENDENCY: ${[...trail.slice(idx), node].join(" -> ")}`);
    }
    stack.add(node);
    trail.push(node);
    for (const dep of graph.get(node) || []) visit(dep);
    trail.pop();
    stack.delete(node);
    visited.add(node);
    order.push(node);
  }
  for (const node of graph.keys()) visit(node);
  return order;
}

function rewriteSpecifiers(code, imports, path, files, blobUrls) {
  const missing = [];
  const sorted = [...imports].sort((a, b) => b.start - a.start);
  let out = code;
  for (const imp of sorted) {
    if (imp.kind === "bare") continue;
    if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|eot)(\?.*)?$/i.test(imp.specifier)) {
      out = stripSideEffectImport(out, imp);
      continue;
    }
    const resolved = resolveSpecifier(path, imp.specifier, files);
    if (!resolved) {
      missing.push({ from: path, specifier: imp.specifier });
      continue;
    }
    if (/\.(css|scss|sass|less)$/i.test(resolved)) {
      out = stripSideEffectImport(out, imp);
      continue;
    }
    const url = blobUrls.get(resolved);
    if (!url) {
      missing.push({ from: path, specifier: imp.specifier });
      continue;
    }
    out = out.slice(0, imp.start) + url + out.slice(imp.end);
  }
  return { code: out, missing };
}

function stripSideEffectImport(code, imp) {
  let start = imp.start;
  while (start > 0 && code[start - 1] !== "\n" && code[start - 1] !== ";") start--;
  const importIdx = code.lastIndexOf("import", imp.start);
  if (importIdx >= 0 && importIdx >= start - 8) start = importIdx;
  let end = imp.end;
  while (end < code.length && code[end] !== ";" && code[end] !== "\n") end++;
  if (end < code.length && code[end] === ";") end++;
  if (end < code.length && code[end] === "\n") end++;
  return code.slice(0, start) + code.slice(end);
}

/** @type {Map<string, string>|null} */
let previousBlobs = null;

async function mount(files, entry, tokensCss) {
  const cssEl = document.getElementById("forge-app-css");
  if (cssEl) cssEl.textContent = files["src/index.css"] || files["index.css"] || "";
  const tokensEl = document.getElementById("forge-tokens");
  if (tokensEl && tokensCss) tokensEl.textContent = tokensCss;

  const ALLOWED_BARE = new Set([
    "react",
    "react-dom",
    "react-dom/client",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "lucide-react",
    "react-router-dom",
    "@tanstack/react-query",
    "zod",
    "clsx",
    "date-fns",
  ]);

  const transformed = new Map();
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(path)) continue;
    if (path.includes("vite.config")) continue;
    const r = transform(content, path);
    if (r.error) {
      send({ type: "forge:transform-error", error: r.error });
      return;
    }
    for (const imp of r.imports || []) {
      if (imp.kind === "bare" && !ALLOWED_BARE.has(imp.specifier)) {
        send({
          type: "forge:transform-error",
          error: {
            path,
            message: `IMPORT_NOT_IN_MANIFEST: "${imp.specifier}" is not in the CDN import map`,
          },
        });
        return;
      }
    }
    transformed.set(path, r);
  }

  if (!transformed.has(entry)) {
    send({
      type: "forge:transform-error",
      error: { path: entry, message: `Entry missing: ${entry}` },
    });
    return;
  }

  let order;
  try {
    order = topoSort(transformed, files);
  } catch (e) {
    send({ type: "forge:transform-error", error: { path: entry, message: String(e.message || e) } });
    return;
  }

  const blobUrls = new Map();
  for (const path of order) {
    const info = transformed.get(path);
    const { code, missing } = rewriteSpecifiers(info.code, info.imports, path, files, blobUrls);
    if (missing.length) {
      send({
        type: "forge:transform-error",
        error: {
          path: missing[0].from,
          message: `MODULE_NOT_FOUND: ${missing[0].specifier} (case-sensitive)`,
        },
      });
      return;
    }
    const blob = new Blob([code], { type: "text/javascript" });
    blobUrls.set(path, URL.createObjectURL(blob));
  }

  const entryUrl = blobUrls.get(entry);
  try {
    // Clear previous React tree
    const root = document.getElementById("root");
    if (root) root.innerHTML = "";
    await import(entryUrl);
    if (previousBlobs) {
      for (const url of previousBlobs.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
    }
    previousBlobs = blobUrls;
    send({ type: "forge:mounted", entry });
  } catch (e) {
    send({
      type: "forge:error",
      kind: "mount",
      message: String(e?.message || e),
      stack: e?.stack,
    });
    // Keep previous blobs if mount failed
    for (const url of blobUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }
}

window.addEventListener("message", (e) => {
  if (!isAllowedOrigin(e.origin)) return;
  if (!PARENT_ORIGIN) PARENT_ORIGIN = e.origin;
  const data = e.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "forge:render") {
    void mount(data.files || {}, data.entry || "src/main.tsx", data.tokens || "");
  }
});

// Standalone draft mode: the API can embed the source bundle directly in the
// shell (GET /projects/{id}/draft), so the page renders without a builder
// parent to postMessage it. In that mode there is no peer to notify.
const DRAFT = window.__FORGE_DRAFT__;
if (DRAFT && DRAFT.files) {
  void mount(DRAFT.files, DRAFT.entry || "src/main.tsx", DRAFT.tokens || "");
} else {
  send({ type: "forge:ready" });
}
