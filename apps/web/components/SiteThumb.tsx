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
   * Stable id for warm-frame reuse across dashboard navigations
   * (e.g. project id). Volatile query params (token) are ignored.
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
type WarmFrame = { iframe: HTMLIFrameElement; ready: boolean };

const HTML_CACHE = new Map<string, CacheEntry>();
const HTML_TTL_MS = 10 * 60 * 1000;
const INFLIGHT = new Map<string, Promise<string>>();

const WARM_FRAMES = new Map<string, WarmFrame>();
const WARM_ORDER: string[] = [];
const MAX_WARM_FRAMES = 24;

function cacheKey(src?: string | null, authPath?: string | null) {
  return authPath || src || "";
}

function warmKey(frameSrc: string, explicit?: string | null): string {
  if (explicit) return `warm:${explicit}`;
  try {
    const u = new URL(frameSrc, typeof window !== "undefined" ? window.location.origin : "http://local");
    // Drop auth/ephemeral params so the same project reuses one parked iframe.
    u.searchParams.delete("access_token");
    u.searchParams.delete("parent_origin");
    return `warm:${u.origin}${u.pathname}?${u.searchParams.toString()}`;
  } catch {
    return `warm:${frameSrc}`;
  }
}

function getHolding(): HTMLDivElement {
  let el = document.getElementById("forge-thumb-holding") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "forge-thumb-holding";
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      left: "-12000px",
      top: "0",
      width: "1280px",
      height: "800px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(el);
  }
  return el;
}

function touchWarm(key: string) {
  const idx = WARM_ORDER.indexOf(key);
  if (idx >= 0) WARM_ORDER.splice(idx, 1);
  WARM_ORDER.push(key);
  while (WARM_ORDER.length > MAX_WARM_FRAMES) {
    const drop = WARM_ORDER.shift();
    if (!drop) break;
    const entry = WARM_FRAMES.get(drop);
    if (!entry) continue;
    WARM_FRAMES.delete(drop);
    try {
      entry.iframe.remove();
    } catch {
      /* ignore */
    }
  }
}

function parkWarmFrame(key: string, iframe: HTMLIFrameElement, ready: boolean) {
  const prev = WARM_FRAMES.get(key);
  if (prev && prev.iframe !== iframe) {
    try {
      prev.iframe.remove();
    } catch {
      /* ignore */
    }
  }
  getHolding().appendChild(iframe);
  WARM_FRAMES.set(key, { iframe, ready });
  touchWarm(key);
}

function takeWarmFrame(key: string): WarmFrame | null {
  const entry = WARM_FRAMES.get(key);
  if (!entry) return null;
  WARM_FRAMES.delete(key);
  const idx = WARM_ORDER.indexOf(key);
  if (idx >= 0) WARM_ORDER.splice(idx, 1);
  return entry;
}

function destroyWarmMatching(match?: string) {
  for (const key of [...WARM_FRAMES.keys()]) {
    if (match && !key.includes(match)) continue;
    const entry = WARM_FRAMES.get(key);
    WARM_FRAMES.delete(key);
    const idx = WARM_ORDER.indexOf(key);
    if (idx >= 0) WARM_ORDER.splice(idx, 1);
    try {
      entry?.iframe.remove();
    } catch {
      /* ignore */
    }
  }
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
    destroyWarmMatching();
    return;
  }
  for (const key of [...HTML_CACHE.keys()]) {
    if (key.includes(match)) HTML_CACHE.delete(key);
  }
  destroyWarmMatching(match);
}

async function fetchThumbHtml(src?: string | null, authPath?: string | null): Promise<string> {
  const key = cacheKey(src, authPath);
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

/** Keep thumb pages from painting a scrollbar that shows through the scale. */
function suppressThumbScroll(html: string): string {
  if (html.includes("data-forge-thumb")) return html;
  const css =
    "<style data-forge-thumb>html,body{overflow:hidden!important;scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}</style>";
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${css}`);
  }
  return css + html;
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
 * Scaled homepage thumbnail via srcDoc (avoids cross-origin iframe blanks).
 * Live draft frames are parked in a warm cache so revisiting the project list
 * does not re-run Babel every time.
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const key = cacheKey(src, authPath);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(() => (key ? readCache(key) : null));
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    readyRef.current = frameReady;
  }, [frameReady]);

  useLayoutEffect(() => {
    if (!frameSrc || !visible) return;
    const host = hostRef.current;
    if (!host) return;

    const keyWarm = warmKey(frameSrc, warmCacheKey);
    const parked = takeWarmFrame(keyWarm);
    let iframe: HTMLIFrameElement;
    let fromCache = false;

    if (parked) {
      iframe = parked.iframe;
      fromCache = true;
      readyRef.current = parked.ready;
      setFrameReady(parked.ready);
    } else {
      iframe = createLiveIframe(frameSrc, title);
      readyRef.current = false;
      setFrameReady(false);
    }

    host.replaceChildren(iframe);
    frameRef.current = iframe;

    function onMessage(e: MessageEvent) {
      if (e.source !== iframe.contentWindow) return;
      const type = e.data && typeof e.data === "object" ? e.data.type : "";
      if (type === "forge:mounted") {
        readyRef.current = true;
        setFrameReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    const grace = window.setTimeout(() => {
      readyRef.current = true;
      setFrameReady(true);
    }, fromCache ? 0 : 15000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(grace);
      frameRef.current = null;
      if (iframe.isConnected || iframe.parentElement === host) {
        // Park ready frames so the next dashboard visit reuses the mount.
        if (readyRef.current) {
          parkWarmFrame(keyWarm, iframe, true);
        } else {
          try {
            iframe.remove();
          } catch {
            /* ignore */
          }
        }
      }
    };
  }, [frameSrc, visible, warmCacheKey, title]);

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
          {visible && (
            <div
              className="site-thumb-scaler"
              style={frameReady ? undefined : { visibility: "hidden" }}
            >
              <div className="site-thumb-host" ref={hostRef} />
            </div>
          )}
          {!frameReady && <div className="site-thumb-fallback is-loading" />}
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
