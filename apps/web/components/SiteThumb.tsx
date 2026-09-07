"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiBase, getToken } from "@/lib/api";

type Props = {
  /** Absolute or API-relative URL for HTML preview */
  src?: string | null;
  /** Authenticated API path (fetched as HTML for srcDoc) */
  authPath?: string | null;
  /**
   * Direct iframe URL for a live render (the project draft route). Unlike the
   * srcDoc modes this executes scripts: it is the only way to show the real
   * site of a generated project, which has no static preview.html.
   */
  frameSrc?: string | null;
  /**
   * Stable id for snapshot reuse across dashboard navigations
   * (e.g. project id + updated_at). Volatile query params (token) are ignored.
   */
  cacheKey?: string | null;
  /**
   * Virtual viewport the page is laid out in before being scaled down to the
   * card. Real sites want a desktop width (1280); template preview.html files
   * are hand-made miniatures with 8-10px type — at 1280 they render as a
   * whole squashed page, so they get a near-native 480px viewport instead.
   */
  viewportWidth?: number;
  viewportHeight?: number;
  title?: string;
  className?: string;
};

type CacheEntry = { html: string; at: number };

const HTML_CACHE = new Map<string, CacheEntry>();
const HTML_TTL_MS = 10 * 60 * 1000;
const INFLIGHT = new Map<string, Promise<string>>();

/** JPEG data-URLs for live draft thumbs — never keep live React iframes around. */
const SNAP_CACHE = new Map<string, string>();
const SNAP_ORDER: string[] = [];
const MAX_SNAPS = 20;
const SNAP_STORAGE_PREFIX = "forge_thumb_snap_v1:";

/** At most one live draft iframe on the whole page (OOM guard). */
let liveSlotBusy = false;
const liveWaiters: Array<() => void> = [];

function acquireLiveSlot(): Promise<void> {
  if (!liveSlotBusy) {
    liveSlotBusy = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    liveWaiters.push(resolve);
  });
}

function releaseLiveSlot() {
  const next = liveWaiters.shift();
  if (next) next();
  else liveSlotBusy = false;
}

function htmlCacheKey(src?: string | null, authPath?: string | null) {
  return authPath || src || "";
}

function snapKey(frameSrc: string, explicit?: string | null): string {
  if (explicit) return explicit;
  try {
    const u = new URL(
      frameSrc,
      typeof window !== "undefined" ? window.location.origin : "http://local",
    );
    u.searchParams.delete("access_token");
    u.searchParams.delete("parent_origin");
    u.searchParams.delete("thumb");
    return `${u.origin}${u.pathname}`;
  } catch {
    return frameSrc;
  }
}

function touchSnap(key: string) {
  const idx = SNAP_ORDER.indexOf(key);
  if (idx >= 0) SNAP_ORDER.splice(idx, 1);
  SNAP_ORDER.push(key);
  while (SNAP_ORDER.length > MAX_SNAPS) {
    const drop = SNAP_ORDER.shift();
    if (!drop) break;
    SNAP_CACHE.delete(drop);
    try {
      sessionStorage.removeItem(SNAP_STORAGE_PREFIX + drop);
    } catch {
      /* ignore */
    }
  }
}

function readSnap(key: string): string | null {
  const mem = SNAP_CACHE.get(key);
  if (mem) {
    touchSnap(key);
    return mem;
  }
  try {
    const stored = sessionStorage.getItem(SNAP_STORAGE_PREFIX + key);
    if (stored && stored.startsWith("data:image/")) {
      SNAP_CACHE.set(key, stored);
      touchSnap(key);
      return stored;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

function writeSnap(key: string, dataUrl: string) {
  SNAP_CACHE.set(key, dataUrl);
  touchSnap(key);
  try {
    sessionStorage.setItem(SNAP_STORAGE_PREFIX + key, dataUrl);
  } catch {
    // Quota exceeded — keep memory copy only; drop oldest storage entries.
    try {
      for (const old of [...SNAP_ORDER]) {
        if (old === key) continue;
        sessionStorage.removeItem(SNAP_STORAGE_PREFIX + old);
      }
      sessionStorage.setItem(SNAP_STORAGE_PREFIX + key, dataUrl);
    } catch {
      /* ignore */
    }
  }
}

function suppressThumbScroll(html: string): string {
  if (html.includes("data-forge-thumb")) return html;
  const css =
    "<style data-forge-thumb>html,body{overflow:hidden!important;scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}</style>";
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${css}`);
  }
  return css + html;
}

function readCache(key: string): string | null {
  const hit = HTML_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > HTML_TTL_MS) {
    HTML_CACHE.delete(key);
    return null;
  }
  return suppressThumbScroll(hit.html);
}

function writeCache(key: string, html: string) {
  HTML_CACHE.set(key, { html, at: Date.now() });
  if (HTML_CACHE.size > 80) {
    const first = HTML_CACHE.keys().next().value;
    if (first) HTML_CACHE.delete(first);
  }
}

export function invalidateThumbCache(match?: string) {
  if (!match) {
    HTML_CACHE.clear();
    for (const key of [...SNAP_CACHE.keys()]) {
      SNAP_CACHE.delete(key);
      try {
        sessionStorage.removeItem(SNAP_STORAGE_PREFIX + key);
      } catch {
        /* ignore */
      }
    }
    SNAP_ORDER.length = 0;
    return;
  }
  for (const key of [...HTML_CACHE.keys()]) {
    if (key.includes(match)) HTML_CACHE.delete(key);
  }
  for (const key of [...SNAP_CACHE.keys()]) {
    if (!key.includes(match)) continue;
    SNAP_CACHE.delete(key);
    const idx = SNAP_ORDER.indexOf(key);
    if (idx >= 0) SNAP_ORDER.splice(idx, 1);
    try {
      sessionStorage.removeItem(SNAP_STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

async function fetchThumbHtml(src?: string | null, authPath?: string | null): Promise<string> {
  const key = htmlCacheKey(src, authPath);
  const cached = readCache(key);
  if (cached) return cached;

  const existing = INFLIGHT.get(key);
  if (existing) return existing;

  const path = authPath || src;
  if (!path) throw new Error("empty");

  const promise = (async () => {
    const url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const headers: HeadersInit = {};
    const token = getToken();
    if (authPath && token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(String(res.status));
    let text = await res.text();
    if (!text.trim()) throw new Error("empty");

    const match = url.match(/\/templates\/([^/]+)\/preview/);
    if (match) {
      const mediaBase = `${apiBase()}/templates/${match[1]}/media/`;
      text = text
        .replace(/(src=["'])public\//gi, `$1${mediaBase}`)
        .replace(/(url\(["']?)public\//gi, `$1${mediaBase}`);
      if (!/<base\s/i.test(text)) {
        text = text.replace(/<head([^>]*)>/i, `<head$1><base href="${mediaBase}">`);
      }
    }

    writeCache(key, text);
    return text;
  })();

  INFLIGHT.set(key, promise);
  try {
    return suppressThumbScroll(await promise);
  } finally {
    INFLIGHT.delete(key);
  }
}

function createLiveIframe(frameSrc: string, title?: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.title = title || "Preview";
  iframe.tabIndex = -1;
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.src = frameSrc;
  return iframe;
}

/**
 * Project cards: live-render once → JPEG snapshot → destroy iframe.
 * Templates: cheap srcDoc HTML (cached). Never parks live React apps —
 * that OOMs Chrome ("Une erreur est survenue") on the dashboard.
 */
export function SiteThumb({
  src,
  authPath,
  frameSrc,
  cacheKey: warmCacheKey,
  viewportWidth = 1280,
  viewportHeight = 800,
  title,
  className,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const key = htmlCacheKey(src, authPath);
  const keySnap = frameSrc ? snapKey(frameSrc, warmCacheKey) : "";
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(() => (key ? readCache(key) : null));
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [snapshot, setSnapshot] = useState<string | null>(() =>
    frameSrc && keySnap ? readSnap(keySnap) : null,
  );

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 320;
      setScale(Math.max(0.08, w / viewportWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportWidth]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Live draft → one-at-a-time capture → static image.
  useLayoutEffect(() => {
    if (!frameSrc || !visible || snapshot) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let iframe: HTMLIFrameElement | null = null;
    let graceTimer = 0;
    let slotHeld = false;
    let onMessage: ((e: MessageEvent) => void) | null = null;

    const dropLive = () => {
      window.clearTimeout(graceTimer);
      if (onMessage) {
        window.removeEventListener("message", onMessage);
        onMessage = null;
      }
      if (iframe) {
        try {
          iframe.remove();
        } catch {
          /* ignore */
        }
        iframe = null;
      }
      host.replaceChildren();
      if (slotHeld) {
        slotHeld = false;
        releaseLiveSlot();
      }
    };

    void (async () => {
      await acquireLiveSlot();
      slotHeld = true;
      if (cancelled) {
        dropLive();
        return;
      }

      // Another card may have filled the cache while we waited.
      const raced = readSnap(keySnap);
      if (raced) {
        setSnapshot(raced);
        dropLive();
        return;
      }

      iframe = createLiveIframe(frameSrc, title);
      host.replaceChildren(iframe);

      onMessage = (e: MessageEvent) => {
        if (cancelled || !iframe || e.source !== iframe.contentWindow) return;
        const type = e.data && typeof e.data === "object" ? e.data.type : "";
        if (type === "forge:thumb-snapshot" && typeof e.data.dataUrl === "string") {
          writeSnap(keySnap, e.data.dataUrl);
          setSnapshot(e.data.dataUrl);
          dropLive();
        }
      };
      window.addEventListener("message", onMessage);

      // If capture never arrives, drop the live frame so we don't OOM.
      graceTimer = window.setTimeout(() => {
        dropLive();
      }, 20000);
    })();

    return () => {
      cancelled = true;
      dropLive();
    };
  }, [frameSrc, visible, snapshot, keySnap, title]);

  useEffect(() => {
    let alive = true;
    if (frameSrc) return;
    if (!key) {
      setHtml(null);
      setFailed(true);
      return;
    }

    const warm = readCache(key);
    if (warm) {
      setHtml(warm);
      setFailed(false);
    } else {
      setHtml(null);
      setFailed(false);
    }

    if (!visible) return;

    void (async () => {
      try {
        const text = await fetchThumbHtml(src, authPath);
        if (!alive) return;
        setHtml(text);
        setFailed(false);
      } catch {
        if (alive && !readCache(key)) setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [src, authPath, key, visible, frameSrc]);

  const showLiveCapture = Boolean(frameSrc && !snapshot && visible);

  return (
    <div
      ref={shellRef}
      className={`site-thumb ${className || ""}`.trim()}
      aria-hidden
      style={{
        ["--thumb-scale" as string]: String(scale),
        ["--thumb-vw" as string]: `${viewportWidth}px`,
        ["--thumb-vh" as string]: `${viewportHeight}px`,
      }}
    >
      {frameSrc ? (
        <>
          {snapshot ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL snapshot, not a remote asset
            <img className="site-thumb-snap" src={snapshot} alt="" draggable={false} />
          ) : (
            <>
              {showLiveCapture && (
                <div className="site-thumb-scaler" style={{ visibility: "hidden" }}>
                  <div className="site-thumb-host" ref={hostRef} />
                </div>
              )}
              <div className="site-thumb-fallback is-loading" />
            </>
          )}
        </>
      ) : html ? (
        <div className="site-thumb-scaler">
          <iframe
            srcDoc={html}
            title={title || "Preview"}
            tabIndex={-1}
            scrolling="no"
            sandbox=""
            loading="lazy"
          />
        </div>
      ) : (
        <div className={`site-thumb-fallback ${failed ? "is-failed" : "is-loading"}`} />
      )}
    </div>
  );
}
