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

/** Thumb snapshots must reach the dashboard even if RUNNER_PARENT_ORIGINS
 *  was misconfigured in prod — the embedder already passed parent_origin. */
const sendThumb = (payload) => {
  let target = PARENT_ORIGIN;
  if (!target) {
    try {
      target = new URLSearchParams(location.search).get("parent_origin") || "";
    } catch {
      target = "";
    }
  }
  const tryPost = (origin) => {
    try {
      parent.postMessage(payload, origin);
      return true;
    } catch {
      return false;
    }
  };
  if (target && tryPost(target)) return;
  tryPost("*");
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

// forge-id-plugin:start (kept identical in public/runner.js, see tests/forge-id.test.mjs)
/** HTML and SVG tags that receive a preview `data-forge-id`. Other lowercase
 *  JSX names (react-three-fiber objects, custom renderers) are left alone:
 *  r3f reads a dashed prop as a nested path and would throw. */
const FORGE_ID_HOST_TAGS = new Set((
  "a abbr address area article aside audio b bdi bdo blockquote body br button canvas caption " +
  "cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset " +
  "figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i iframe img input ins kbd " +
  "label legend li main map mark menu meter nav noscript object ol optgroup option output p " +
  "picture pre progress q rp rt ruby s samp search section select slot small source span strong " +
  "sub summary sup table tbody td template textarea tfoot th thead time tr track u ul var video " +
  "wbr svg circle clipPath defs ellipse g line linearGradient mask path pattern polygon " +
  "polyline radialGradient rect stop symbol text tspan use"
).split(" "));
const FORGE_ID_ATTR = "data-forge-id";

/** Preview only: tag every host JSX element with `data-forge-id="<file>:<line>:<col>"`
 *  (1-based line and column of the opening `<`). Files importing a
 *  @react-three package are skipped: their lowercase tags are 3D objects. */
function forgeIdPreviewPlugin(api, opts) {
  const t = api.types;
  return {
    visitor: {
      Program(path, state) {
        state.forgeIdSkip = path.node.body.some(
          (s) =>
            t.isImportDeclaration(s) &&
            typeof s.source.value === "string" &&
            s.source.value.startsWith("@react-three/"),
        );
      },
      JSXOpeningElement(path, state) {
        if (state.forgeIdSkip) return;
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || !FORGE_ID_HOST_TAGS.has(name.name)) return;
        const loc = path.node.loc;
        if (!loc) return;
        const file = String((opts && opts.file) || state.filename || "");
        const value = file + ":" + loc.start.line + ":" + (loc.start.column + 1);
        const attrs = path.node.attributes;
        // An id copied into the source by hand would point at the wrong place:
        // the fresh location always wins.
        for (let i = attrs.length - 1; i >= 0; i--) {
          const a = attrs[i];
          if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === FORGE_ID_ATTR) {
            attrs.splice(i, 1);
          }
        }
        attrs.push(t.jsxAttribute(t.jsxIdentifier(FORGE_ID_ATTR), t.stringLiteral(value)));
      },
    },
  };
}
// forge-id-plugin:end

function needsRouterBasename(code) {
  return code.includes("BrowserRouter") || code.includes("createBrowserRouter");
}

function resolveAssetUrl(src, assets) {
  if (!assets || typeof assets.base !== "string" || typeof src !== "string") return null;
  if (!src.startsWith("/") || src.startsWith("//")) return null;
  let base;
  try {
    base = new URL(assets.base, location.href);
  } catch {
    return null;
  }
  // The runner is served by the API that also serves project assets, so only
  // that origin is used; any other base is ignored.
  if (base.origin !== location.origin) return null;
  const path = base.pathname.replace(/\/+$/, "") + src;
  const sep = src.includes("?") ? "&" : "?";
  const query = assets.token ? `${sep}access_token=${encodeURIComponent(assets.token)}` : "";
  return location.origin + path + query;
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
  // No quotes between `import` and `from` — avoids spanning into string
  // literals like children: "or start from" after an `export function`.
  /\bimport\s+(?:type\s+)?(?:[^"'`;]+?)\s+from\s*["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']/g,
];

function classifySpecifier(specifier) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return "relative";
  if (specifier.startsWith("@/") || specifier.startsWith("/")) return "alias";
  return "bare";
}

function isPlausibleModuleSpecifier(specifier) {
  if (!specifier || specifier.length > 200) return false;
  if (/[\s\r\n{},;()]/.test(specifier)) return false;
  if (/\/\*|\*\/|#__PURE__|_jsxs?/.test(specifier)) return false;
  return true;
}

function collectImports(code) {
  const out = [];
  const seen = new Set();
  for (const pattern of STATEMENT_IMPORT_RES) {
    const re = new RegExp(pattern.source, "g");
    let m;
    while ((m = re.exec(code))) {
      const specifier = m[1];
      if (!specifier || !isPlausibleModuleSpecifier(specifier)) continue;
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
    const plugins = [[forgeIdPreviewPlugin, { file: path }]];
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

// Package stylesheets (`import "swiper/css"`): specifier pattern -> CDN URL,
// injected by the shell from runtime/packages.json.
const PACKAGE_CSS = window.__FORGE_CSS_IMPORTS__ || {};

function packageCssUrl(spec) {
  for (const [pattern, url] of Object.entries(PACKAGE_CSS)) {
    if (pattern.endsWith("/*") ? spec.startsWith(pattern.slice(0, -1)) : spec === pattern) return url;
  }
  return null;
}

function linkPackageCss(urls) {
  const holder = document.head;
  const wanted = new Set(urls);
  for (const el of [...holder.querySelectorAll("link[data-forge-pkg-css]")]) {
    if (!wanted.has(el.getAttribute("href"))) el.remove();
  }
  for (const url of wanted) {
    if (holder.querySelector(`link[data-forge-pkg-css][href="${CSS.escape(url)}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.setAttribute("data-forge-pkg-css", "");
    holder.appendChild(link);
  }
}

// Mirrors runtime/css.mjs: @import is only valid before other rules, so the
// imports found anywhere (web fonts on top of index.css, or in a page file)
// are hoisted to the top of the combined sheet.
const CSS_IMPORT_RE =
  /@import\s+(?:url\(\s*(["'])(.*?)\1\s*\)|(["'])(.*?)\3|url\(\s*([^)\s]+)\s*\))([^;]*);/g;

function assembleCss(files) {
  const paths = Object.keys(files)
    .filter((p) => /\.css$/i.test(p))
    .sort((a, b) => {
      if (a === "src/index.css" || a === "index.css") return -1;
      if (b === "src/index.css" || b === "index.css") return 1;
      return a < b ? -1 : 1;
    });
  const hoisted = [];
  const seen = new Set();
  const bodies = paths.map((p) =>
    String(files[p] || "").replace(CSS_IMPORT_RE, (m) => {
      const key = m.replace(/\s+/g, " ");
      if (!seen.has(key)) {
        seen.add(key);
        hoisted.push(m);
      }
      return "";
    }),
  );
  return [...hoisted, ...bodies].join("\n\n");
}

const ASSET_IMPORT_RE = /\.(svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wav)(\?.*)?$/i;

// `import logo from "./logo.png"` → the file's root URL; root-path images are
// then rewritten to the project asset endpoint like any other <img>.
function assetRootUrl(fromPath, spec) {
  const clean = spec.split("?")[0];
  if (clean.startsWith("@/")) return "/src/" + clean.slice(2);
  if (clean.startsWith("/")) return clean;
  const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  return "/" + normalizeJoin(fromDir, clean);
}

function rewriteAssetImport(code, imp, url) {
  const start = code.lastIndexOf("import", imp.start);
  if (start < 0) return code;
  let end = imp.end;
  while (end < code.length && code[end] !== ";" && code[end] !== "\n") end++;
  if (end < code.length && code[end] === ";") end++;
  const statement = code.slice(start, end);
  const binding =
    (statement.match(/^import\s+([A-Za-z_$][\w$]*)\s+from/) || [])[1] ||
    (statement.match(/^import\s*\{\s*default\s+as\s+([A-Za-z_$][\w$]*)\s*\}/) || [])[1];
  // The root URL, like a literal "/images/x.png": <img> rewriting resolves it
  // and keeps it in data-forge-src for the visual-image bridge.
  return code.slice(0, start) + (binding ? `const ${binding} = ${JSON.stringify(url)};` : "") + code.slice(end);
}

function rewriteSpecifiers(code, imports, path, files, blobUrls, packageCss) {
  const missing = [];
  const sorted = [...imports].sort((a, b) => b.start - a.start);
  let out = code;
  for (const imp of sorted) {
    if (imp.kind === "bare") {
      const cssUrl = packageCssUrl(imp.specifier);
      if (cssUrl) {
        packageCss.add(cssUrl);
        out = stripSideEffectImport(out, imp);
      }
      continue;
    }
    if (/\.(css|scss|sass|less)(\?.*)?$/i.test(imp.specifier)) {
      out = stripSideEffectImport(out, imp);
      continue;
    }
    if (ASSET_IMPORT_RE.test(imp.specifier)) {
      out = rewriteAssetImport(out, imp, assetRootUrl(path, imp.specifier));
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
async function waitForFirstPaint(timeoutMs = 4000) {
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
    if (document.fonts && document.fonts.ready) {
      // Unbounded fonts.ready hung dashboard thumbs when a webfont never loaded.
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    }
  } catch {
    /* ignore */
  }
  // Give remote images a short window; don't block forever (dashboard OOM risk).
  const imgs = [...document.images];
  if (imgs.length) {
    await Promise.race([
      Promise.all(
        imgs.map(
          (img) =>
            img.complete ||
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
      ),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  }
}

function isThumbMode() {
  try {
    return new URLSearchParams(location.search).get("thumb") === "1";
  } catch {
    return false;
  }
}

/**
 * Dashboard cards must not keep a live React tree. Capture a small JPEG and
 * post it to the parent so the iframe can be destroyed (prevents Chrome OOM
 * when many project thumbs mount at once).
 */
async function waitForThumbPaint(phoneLike) {
  const deadline = Date.now() + (phoneLike ? 10000 : 4000);
  while (Date.now() < deadline) {
    const root = document.getElementById("root");
    if (
      root &&
      root.childElementCount > 0 &&
      (root.innerText || "").replace(/\s+/g, " ").trim().length > 8
    ) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, phoneLike ? 350 : 150));
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function phoneWatchdogMs() {
  return (window.innerWidth || 1280) <= 500 ? 22000 : 12000;
}

/** The html2canvas module used by every preview capture (dashboard thumb, pages rail). */
async function loadHtml2Canvas() {
  const mod = await Promise.race([
    import("https://esm.sh/html2canvas@1.4.1"),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("html2canvas-import-timeout")), 5000),
    ),
  ]);
  return mod.default || mod;
}

async function captureThumbSnapshot() {
  // Phone previews are narrow. Dashboard cards are ~16:10 landscape — capture
  // the top band of the phone UI so the JPEG fills the card (full-height
  // 390×844 portraits letterbox badly and often persisted as empty solids).
  const phoneLike = (window.innerWidth || 1280) <= 500;
  const w = phoneLike
    ? Math.min(window.innerWidth || 390, 430)
    : Math.min(window.innerWidth || 1280, 1280);
  const h = phoneLike
    ? Math.round(w * (10 / 16))
    : Math.min(window.innerHeight || 800, 800);
  const scale = phoneLike ? 0.85 : 0.4;
  await waitForThumbPaint(phoneLike);
  const target = document.getElementById("root") || document.body;

  const attempts = phoneLike ? 3 : 1;
  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 600 * i));
      const html2canvas = await loadHtml2Canvas();
      const shot = await Promise.race([
        html2canvas(target, {
          width: w,
          height: h,
          windowWidth: Math.max(w, window.innerWidth || w),
          windowHeight: Math.max(h, window.innerHeight || h),
          x: 0,
          y: 0,
          scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: "#111111",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("html2canvas-timeout")), 7000),
        ),
      ]);
      const dataUrl = shot.toDataURL("image/jpeg", 0.78);
      // Tiny JPEGs are almost always empty/solid placeholders — refuse so the
      // parent can retry or show the branded fallback instead of persisting junk.
      if (dataUrl && dataUrl.length >= 3500) return dataUrl;
    } catch {
      /* retry */
    }
  }
  return null;
}

async function mount(files, entry, tokensCss, assets) {
  // Thumb mode: hard deadline so a hung Babel/import still releases the
  // dashboard card (parent grace alone left cards on shimmer forever).
  let thumbWatchdog = 0;
  let thumbSent = false;
  const emitThumb = async () => {
    if (!isThumbMode() || thumbSent) return;
    thumbSent = true;
    if (thumbWatchdog) window.clearTimeout(thumbWatchdog);
    try {
      const dataUrl = await captureThumbSnapshot();
      if (dataUrl) sendThumb({ type: "forge:thumb-snapshot", dataUrl });
    } catch {
      /* ignore */
    }
    const rootClear = document.getElementById("root");
    if (rootClear) rootClear.replaceChildren();
  };
  if (isThumbMode()) {
    thumbWatchdog = window.setTimeout(() => {
      void emitThumb();
    }, phoneWatchdogMs());
  }
  try {
  if (assets && typeof assets.base === "string" && assets.base) ASSETS = assets;
  if (assets && typeof assets.routerBase === "string" && assets.routerBase) {
    window.__FORGE_PREVIEW_SHELL_BASE__ = assets.routerBase;
  }
  const cssEl = document.getElementById("forge-app-css");
  if (cssEl) {
    // Every stylesheet ships, index.css (tokens/layout) first: per-page CSS
    // files let plan tasks style their own page without rewriting — and
    // breaking — the shared foundation.
    cssEl.textContent = assembleCss(files);
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
    exactBare.has(spec) ||
    prefixBare.some((prefix) => spec.startsWith(prefix)) ||
    Boolean(packageCssUrl(spec));

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
  const packageCss = new Set();
  for (const path of order) {
    const info = transformed.get(path);
    const { code, missing } = rewriteSpecifiers(info.code, info.imports, path, files, blobUrls, packageCss);
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

  linkPackageCss([...packageCss]);
  const entryUrl = blobUrls.get(entry);
  try {
    // Clear previous React tree (replaceChildren avoids innerHTML write path).
    const root = document.getElementById("root");
    if (root) root.replaceChildren();
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
  } finally {
    // Always notify the dashboard in thumb mode — early transform returns used
    // to skip this and leave cards stuck on the loading shimmer forever.
    await emitThumb();
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
  if (data.type === "forge:capture-thumb") {
    // Builder asks for a persistent dashboard JPEG after an agent run.
    void (async () => {
      try {
        const dataUrl = await captureThumbSnapshot();
        if (dataUrl) sendThumb({ type: "forge:thumb-snapshot", dataUrl });
      } catch {
        /* ignore */
      }
    })();
  }
  if (data.type === "forge:capture-page") {
    // Builder pages rail: a small picture of the page on screen. The reply
    // echoes `requestId` so the builder files it under the route it asked for.
    const requestId = typeof data.requestId === "string" ? data.requestId.slice(0, 80) : "";
    const width = Math.max(120, Math.min(Number(data.width) || 320, 480));
    void (async () => {
      let reason = "";
      const dataUrl = await capturePageSnapshot(width).catch((err) => {
        reason = String((err && err.message) || err || "error").slice(0, 160);
        return null;
      });
      // `reason` only helps debugging: the builder keeps its placeholder either way.
      send({ type: "forge:page-snapshot", requestId, dataUrl: dataUrl || null, reason: dataUrl ? "" : reason || "empty" });
    })();
  }
});

let pageCaptureBusy = false;

// html2canvas 1.4 cannot parse CSS Color 4 values (`color(srgb ...)`, oklch,
// lab...), which Tailwind 4 and color-mix() produce: it throws on the whole
// capture. In the clone it draws, rewrite those values as rgba().
const MODERN_COLOR_RE = /\b(?:color|oklch|oklab|lch|lab|hwb)\((?:[^()]|\([^()]*\))*\)/gi;
const COLOR_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "text-shadow",
  "fill",
  "stroke",
  "caret-color",
  "column-rule-color",
];

function modernColorConverter() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  return (value) => {
    const hit = cache.get(value);
    if (hit) return hit;
    let out = "rgba(0, 0, 0, 0)";
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${Math.round((d[3] / 255) * 1000) / 1000})`;
    }
    cache.set(value, out);
    return out;
  };
}

function rewriteModernColors(doc) {
  const view = doc.defaultView;
  if (!view) return;
  const toRgba = modernColorConverter();
  for (const el of doc.querySelectorAll("*")) {
    let cs;
    try {
      cs = view.getComputedStyle(el);
    } catch {
      continue;
    }
    for (const prop of COLOR_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (!value || !MODERN_COLOR_RE.test(value)) continue;
      MODERN_COLOR_RE.lastIndex = 0;
      el.style.setProperty(prop, value.replace(MODERN_COLOR_RE, (m) => toRgba(m)), "important");
    }
    MODERN_COLOR_RE.lastIndex = 0;
  }
}

/**
 * Top of the current page at viewport proportions (portrait in a phone
 * frame), scaled down to `width` pixels. Null when nothing useful rendered.
 */
async function capturePageSnapshot(width) {
  if (pageCaptureBusy) throw new Error("busy");
  pageCaptureBusy = true;
  try {
    const target = document.getElementById("root") || document.body;
    if (!target || target.childElementCount === 0) throw new Error("nothing-rendered");
    const vw = Math.max(1, Math.min(window.innerWidth || 1280, 1600));
    const vh = Math.max(1, Math.min(window.innerHeight || 800, Math.round(vw * 2.2)));
    const scale = Math.min(1, width / vw);
    const html2canvas = await loadHtml2Canvas();
    let background = "#ffffff";
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        background = MODERN_COLOR_RE.test(bg) ? modernColorConverter()(bg) : bg;
        MODERN_COLOR_RE.lastIndex = 0;
      }
    } catch {
      /* keep white */
    }
    const shot = await Promise.race([
      html2canvas(target, {
        width: vw,
        height: vh,
        windowWidth: vw,
        windowHeight: vh,
        x: 0,
        y: 0,
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: background,
        onclone: (clonedDoc) => rewriteModernColors(clonedDoc),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("html2canvas-timeout")), 7000)),
    ]);
    let dataUrl = "";
    try {
      dataUrl = shot.toDataURL("image/webp", 0.72);
    } catch {
      dataUrl = "";
    }
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = shot.toDataURL("image/jpeg", 0.72);
    // A few hundred bytes is a blank frame: the builder keeps its placeholder.
    if (!dataUrl || dataUrl.length < 1500) throw new Error(`blank-${dataUrl ? dataUrl.length : 0}`);
    return dataUrl;
  } finally {
    pageCaptureBusy = false;
  }
}

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
