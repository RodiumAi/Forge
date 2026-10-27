/**
 * Pure parts of the builder pages rail: page labels, multi-selection, the
 * thumbnail cache and the "[Target pages: ...]" marker carried by a message.
 */

/** Name shown for a route: "/" is the home page, "/menu/plats" reads "menu / plats". */
export function pageLabel(path: string, homeLabel: string): string {
  const clean = (path || "/").split(/[?#]/)[0].replace(/\/+$/, "");
  if (!clean || clean === "/") return homeLabel;
  const parts = clean
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    });
  return parts.join(" / ") || homeLabel;
}

export type SelectMode = "toggle" | "range" | "only";

/**
 * Next selection after a click on `path`.
 * - `toggle` (checkbox, Ctrl/Cmd click) adds or removes one page,
 * - `range` (Shift click) adds every page between `anchor` and `path`,
 * - `only` keeps just that page.
 * The result follows the order of `all`, so chips and the marker are stable.
 */
export function nextPageSelection(
  selected: readonly string[],
  path: string,
  mode: SelectMode,
  all: readonly string[],
  anchor?: string | null,
): string[] {
  const set = new Set(selected.filter((p) => all.includes(p)));
  if (mode === "only") {
    set.clear();
    set.add(path);
  } else if (mode === "range" && anchor && all.includes(anchor) && all.includes(path)) {
    const a = all.indexOf(anchor);
    const b = all.indexOf(path);
    const [from, to] = a <= b ? [a, b] : [b, a];
    for (let i = from; i <= to; i++) set.add(all[i]);
  } else if (set.has(path)) {
    set.delete(path);
  } else {
    set.add(path);
  }
  return all.filter((p) => set.has(p));
}

/* ---------- thumbnails ---------- */

/** Biggest snapshot kept (a ~320px WebP is usually 10 to 30 KB). */
export const THUMB_MAX_CHARS = 120_000;
/** Total budget of the sessionStorage copy, all projects together. */
export const THUMB_STORAGE_BUDGET = 1_500_000;
const STORAGE_KEY = "forge.pageThumbs.v1";

type StoredEntry = { k: string; d: string; t: number };

export type ThumbStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function thumbKey(projectId: string, path: string): string {
  return `${projectId}::${path}`;
}

function defaultStorage(): ThumbStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Snapshot of each page, captured when the page is shown in the preview.
 * Memory first; a copy in sessionStorage (size-guarded, oldest out first)
 * survives a reload of the builder tab. Every storage access may throw
 * (private mode, quota): the cache then simply lives in memory.
 */
export class PageThumbCache {
  private mem = new Map<string, { dataUrl: string; at: number }>();
  private listeners = new Set<() => void>();
  private loaded = false;
  private version = 0;

  constructor(
    private storage: ThumbStorage | null = defaultStorage(),
    private now: () => number = () => Date.now(),
  ) {}

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as StoredEntry[];
      if (!Array.isArray(list)) return;
      for (const e of list) {
        if (e && typeof e.k === "string" && typeof e.d === "string" && e.d.startsWith("data:image/")) {
          this.mem.set(e.k, { dataUrl: e.d, at: Number(e.t) || 0 });
        }
      }
    } catch {
      /* corrupt or blocked storage: start empty */
    }
  }

  private persist() {
    if (!this.storage) return;
    const entries = [...this.mem.entries()]
      .map(([k, v]) => ({ k, d: v.dataUrl, t: v.at }))
      .sort((a, b) => b.t - a.t);
    const kept: StoredEntry[] = [];
    let size = 0;
    for (const e of entries) {
      const cost = e.d.length + e.k.length + 24;
      if (size + cost > THUMB_STORAGE_BUDGET) continue;
      kept.push(e);
      size += cost;
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  }

  get(projectId: string, path: string): string | null {
    this.load();
    return this.mem.get(thumbKey(projectId, path))?.dataUrl ?? null;
  }

  /** Stores a snapshot. Returns false (and keeps the old one) when it is not a usable image. */
  set(projectId: string, path: string, dataUrl: string): boolean {
    this.load();
    if (!projectId || !path) return false;
    if (typeof dataUrl !== "string" || !/^data:image\/(webp|jpeg|png);base64,/.test(dataUrl)) return false;
    if (dataUrl.length > THUMB_MAX_CHARS) return false;
    const key = thumbKey(projectId, path);
    if (this.mem.get(key)?.dataUrl === dataUrl) return true;
    this.mem.set(key, { dataUrl, at: this.now() });
    this.version += 1;
    this.persist();
    for (const fn of this.listeners) fn();
    return true;
  }

  /** Changes on every `set`, for `useSyncExternalStore`. */
  getVersion(): number {
    return this.version;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

/* ---------- message marker ---------- */

const MARKER_RE = /\[(?:Pages ciblées|Target pages):\s*([^\]]*)\]/i;
const MARKER_RE_GLOBAL = /\[(?:Pages ciblées|Target pages):\s*[^\]]*\]/gi;

/**
 * Plain-text line put in front of the message: it reaches the model even
 * without the structured target, and the chat bubble shows it as a tag.
 * Example: `[Pages ciblées: / (Accueil), /carte]`.
 */
export function formatPagesMarker(paths: readonly string[], label: string, homeLabel: string): string {
  if (!paths.length) return "";
  const list = paths.map((p) => (p === "/" ? `/ (${homeLabel})` : p)).join(", ");
  return `[${label}: ${list}]`;
}

/** Routes of the first pages marker in a stored message, or an empty list. */
export function parsePagesMarker(raw: string): string[] {
  const match = (raw || "").match(MARKER_RE);
  if (!match) return [];
  const out: string[] = [];
  for (const part of (match[1] || "").split(",")) {
    const path = part.trim().replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (path.startsWith("/") && !out.includes(path)) out.push(path);
  }
  return out;
}

export function stripPagesMarker(raw: string): string {
  return (raw || "").replace(MARKER_RE_GLOBAL, "");
}

/* ---------- screens without routes ---------- */

const SCREEN_STATE_RE = /const\s*\[\s*(\w+)\s*,\s*set\w*?(?:Tab|Screen|Page|View|Route)\s*\]\s*=\s*(?:React\.)?useState\b/g;
const ROUTER_RE = /<Routes\b|createBrowserRouter|createHashRouter|useRoutes\s*\(/;

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Screens an older project switches with a `useState` instead of URL routes
 * (`tab === "search" && <SearchScreen />`): the URL never changes, so the
 * rail only ever sees one page. Empty when the app has a router or no such
 * switch (3 rendered branches at least, a two-way toggle is not a page set).
 */
export function stateScreenNames(sources: Record<string, string>): string[] {
  const files = Object.entries(sources).filter(([path]) => /^src\/.+\.(tsx|jsx)$/i.test(path.replace(/\\/g, "/")));
  if (files.some(([, content]) => ROUTER_RE.test(content))) return [];
  for (const [, content] of files) {
    for (const match of content.matchAll(SCREEN_STATE_RE)) {
      const name = escapeRe(match[1]);
      const found = new Set<string>();
      const branch = new RegExp(`\\b${name}\\s*===?\\s*["'](\\w[\\w-]*)["']\\s*(?:&&|\\?)\\s*\\(?\\s*<[A-Za-z>]`, "g");
      for (const m of content.matchAll(branch)) found.add(m[1]);
      if (new RegExp(`switch\\s*\\(\\s*${name}\\s*\\)`).test(content)) {
        for (const m of content.matchAll(/case\s*["'](\w[\w-]*)["']\s*:\s*return\s*\(?\s*<[A-Za-z>]/g)) found.add(m[1]);
      }
      if (found.size >= 3) return Array.from(found);
    }
  }
  return [];
}
