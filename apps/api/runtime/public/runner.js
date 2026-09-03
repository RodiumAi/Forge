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

// The embedder is the only peer we talk to. Prefer an explicit allowlisted
// `parent_origin` query (dashboard thumbs often lack a usable referrer under
// sandbox), then fall back to document.referrer. Never widened at runtime.
let PARENT_ORIGIN = (() => {
  try {
    const fromQuery = new URLSearchParams(location.search).get("parent_origin") || "";
    if (fromQuery && isAllowedOrigin(fromQuery)) return fromQuery;
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

// ---------------------------------------------------------------------------
// Project asset resolution.
//
// Generated code references project files with root paths (`/images/x.png`,
// `/favicon.png`). Those work on the published site — publish copies public/
// to the site root — but here the iframe origin is the API, where `/images/…`
// is a 404. The embedder (or the draft route) provides the authenticated
// project-public endpoint; every root-path <img> is rewritten to it, with the
// original kept in data-forge-src so the visual-image bridge still reports
// the literal that actually lives in the source.
let ASSETS = null; // { base: string, token?: string, routerBase?: string }

/** Preview shell prefix: /runner or /projects/{uuid}/draft — never bare API /. */
function getPreviewShellBase() {
  if (typeof window.__FORGE_PREVIEW_SHELL_BASE__ === "string" && window.__FORGE_PREVIEW_SHELL_BASE__) {
    return window.__FORGE_PREVIEW_SHELL_BASE__;
  }
  const p = window.location.pathname || "";
  const draft = p.match(/^(\/projects\/[0-9a-f-]{36}\/draft)\/?/i);
  if (draft) return draft[1];
  if (/^\/runner\/?/i.test(p)) return "/runner";
  return "";
}

function jsxHasBasenameAttr(attributes) {
  return attributes.some(
    (a) =>
      a.type === "JSXAttribute" &&
      a.name &&
      a.name.type === "JSXIdentifier" &&
      a.name.name === "basename",
  );
}

function objectHasBasenameProperty(properties) {
  return properties.some((p) => {
    if (p.type !== "ObjectProperty") return false;
    const key = p.key;
    return (
      (key.type === "Identifier" && key.name === "basename") ||
      (key.type === "StringLiteral" && key.value === "basename")
    );
  });
}

/** Inject react-router basename so /projects/{id}/draft maps to app routes (/). */
function basenamePreviewPlugin(_api, opts) {
  const t = _api.types;
  const base = opts.basename;
  if (!base) return { visitor: {} };

  function addBasenameAttr(path) {
    if (jsxHasBasenameAttr(path.node.attributes)) return;
    path.node.attributes.unshift(
      t.jsxAttribute(t.jsxIdentifier("basename"), t.stringLiteral(base)),
    );
  }

  function ensureBasenameOptions(args) {
    let opts = args[1];
    if (!opts) {
      opts = t.objectExpression([]);
      args.push(opts);
    }
    if (!t.isObjectExpression(opts) || objectHasBasenameProperty(opts.properties)) return;
    opts.properties.unshift(
      t.objectProperty(t.identifier("basename"), t.stringLiteral(base)),
    );
  }

  return {
    visitor: {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (t.isJSXIdentifier(name) && name.name === "BrowserRouter") {
          addBasenameAttr(path);
          return;
        }
        if (
          t.isJSXMemberExpression(name) &&
          t.isJSXIdentifier(name.property) &&
          name.property.name === "BrowserRouter"
        ) {
          addBasenameAttr(path);
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isIdentifier(callee) || callee.name !== "createBrowserRouter") return;
        if (!path.node.arguments.length) return;
        ensureBasenameOptions(path.node.arguments);
      },
    },
  };
}

function needsRouterBasename(code) {
  return code.includes("BrowserRouter") || code.includes("createBrowserRouter");
}

function resolveAssetUrl(src, assets) {
  if (!assets || !assets.base || typeof src !== "string") return null;
  if (!src.startsWith("/") || src.startsWith("//")) return null;
  const base = assets.base.replace(/\/+$/, "");
  const sep = src.includes("?") ? "&" : "?";
  return assets.token ? `${base}${src}${sep}access_token=${encodeURIComponent(assets.token)}` : `${base}${src}`;
}

function rewriteImageEl(el) {
  const src = el.getAttribute("src") || "";
  const resolved = resolveAssetUrl(src, ASSETS);
  if (!resolved || resolved === src) return;
  el.setAttribute("data-forge-src", src);
  el.setAttribute("src", resolved);
}

function rewriteImagesUnder(rootNode) {
  if (!ASSETS || !rootNode) return;
  if (rootNode.tagName === "IMG") rewriteImageEl(rootNode);
  if (rootNode.querySelectorAll) {
    for (const el of rootNode.querySelectorAll("img")) rewriteImageEl(el);
  }
}

new MutationObserver((records) => {
  if (!ASSETS) return;
  for (const record of records) {
    if (record.type === "attributes" && record.target.tagName === "IMG") {
      rewriteImageEl(record.target);
      continue;
    }
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) rewriteImagesUnder(node);
    }
  }
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["src"],
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
    const base = getPreviewShellBase();
    const plugins = [];
    if (base && needsRouterBasename(code)) {
      plugins.push([basenamePreviewPlugin, { basename: base }]);
    }
    const out = Babel.transform(code, {
      filename: path,
      presets: PRESETS,
      plugins,
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

/**
 * `import(entry)` resolves as soon as the module runs — typically before
 * React's first paint. Dashboard thumbs were revealing a solid white #root
 * because forge:mounted fired on that empty frame. Wait until the tree has
 * content and at least one paint has committed.
 */
async function waitForFirstPaint(timeoutMs = 8000) {
  const root = document.getElementById("root");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (root && root.childElementCount > 0) break;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

async function mount(files, entry, tokensCss, assets) {
  if (assets && typeof assets.base === "string" && assets.base) ASSETS = assets;
  if (assets && typeof assets.routerBase === "string" && assets.routerBase) {
    window.__FORGE_PREVIEW_SHELL_BASE__ = assets.routerBase;
  }
  const cssEl = document.getElementById("forge-app-css");
  if (cssEl) {
    // Every stylesheet ships, index.css (tokens/layout) first: per-page CSS
    // files let plan tasks style their own page without rewriting — and
    // breaking — the shared foundation.
    const cssPaths = Object.keys(files)
      .filter((p) => /\.css$/i.test(p))
      .sort((a, b) => {
        if (a === "src/index.css" || a === "index.css") return -1;
        if (b === "src/index.css" || b === "index.css") return 1;
        return a < b ? -1 : 1;
      });
    cssEl.textContent = cssPaths.map((p) => files[p]).join("\n\n");
  }
  const tokensEl = document.getElementById("forge-tokens");
  if (tokensEl && tokensCss) tokensEl.textContent = tokensCss;

  // The allowlist IS the document's import map — base manifest plus the
  // project's own package.json dependencies injected by the shell (?p=).
  // The hardcoded set it replaces drifted from the manifest and rejected
  // packages the user had legitimately declared.
  const importMapKeys = (() => {
    try {
      const el = document.getElementById("forge-importmap");
      return Object.keys(JSON.parse(el?.textContent || "{}").imports || {});
    } catch {
      return [];
    }
  })();
  const exactBare = new Set(importMapKeys);
  const prefixBare = importMapKeys.filter((k) => k.endsWith("/"));
  const isAllowedBare = (spec) =>
    exactBare.has(spec) || prefixBare.some((prefix) => spec.startsWith(prefix));

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
      if (imp.kind === "bare" && !isAllowedBare(imp.specifier)) {
        send({
          type: "forge:transform-error",
          error: {
            path,
            message:
              `IMPORT_NOT_IN_MANIFEST: "${imp.specifier}" is not available — ` +
              'declare it in package.json "dependencies" to make it importable',
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
    // The observer only sees future mutations; images already in the tree
    // (or an ASSETS config arriving after the first render) need one pass.
    rewriteImagesUnder(document.body);
    await waitForFirstPaint();
    rewriteImagesUnder(document.body);
    const rootEl = document.getElementById("root");
    if (rootEl && rootEl.childElementCount === 0) {
      // Compiled and mounted, yet nothing rendered — a thrown render or an
      // App that returns null. Without this signal the user just saw white.
      send({
        type: "forge:error",
        kind: "blank",
        message: "App mounted but rendered nothing (blank page). Check App.tsx render output.",
      });
    }
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
    void mount(data.files || {}, data.entry || "src/main.tsx", data.tokens || "", data.assets || null);
  }
});

// Standalone draft mode: the API can embed the source bundle directly in the
// shell (GET /projects/{id}/draft), so the page renders without a builder
// parent to postMessage it. In that mode there is no peer to notify.
const DRAFT = window.__FORGE_DRAFT__;
if (DRAFT && DRAFT.assets && typeof DRAFT.assets.routerBase === "string") {
  window.__FORGE_PREVIEW_SHELL_BASE__ = DRAFT.assets.routerBase;
}
if (DRAFT && DRAFT.files) {
  void mount(DRAFT.files, DRAFT.entry || "src/main.tsx", DRAFT.tokens || "", DRAFT.assets || null);
} else {
  send({ type: "forge:ready" });
}
