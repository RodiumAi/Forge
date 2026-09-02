"use client";

import { useEffect, useRef, useState } from "react";
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

/** Dashboard cards: one live draft iframe at a time — Babel in parallel freezes the tab. */
const DRAFT_FRAME_QUEUE: Array<() => void> = [];
let draftFramesActive = 0;
const DRAFT_FRAME_MAX = 1;

function acquireDraftFrameSlot(): Promise<void> {
  if (draftFramesActive < DRAFT_FRAME_MAX) {
    draftFramesActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    DRAFT_FRAME_QUEUE.push(() => {
      draftFramesActive += 1;
      resolve();
    });
  });
}

function releaseDraftFrameSlot() {
  draftFramesActive = Math.max(0, draftFramesActive - 1);
  const next = DRAFT_FRAME_QUEUE.shift();
  if (next) next();
}

function cacheKey(src?: string | null, authPath?: string | null) {
  return authPath || src || "";
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
    return;
  }
  for (const key of [...HTML_CACHE.keys()]) {
    if (key.includes(match)) HTML_CACHE.delete(key);
  }
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

/**
 * Scaled homepage thumbnail. Project cards use a live draft iframe (queued: one
 * at a time so the dashboard does not run N Babel compiles in parallel).
 * Templates use cached srcDoc.
 */
export function SiteThumb({
  src,
  authPath,
  frameSrc,
  viewportWidth = 1280,
  viewportHeight = 800,
  title,
  className,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const key = cacheKey(src, authPath);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(() => (key ? readCache(key) : null));
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [frameReady, setFrameReady] = useState(false);
  const [frameAllowed, setFrameAllowed] = useState(false);
  const slotHeldRef = useRef(false);

  useEffect(() => {
    if (!frameSrc || !visible) {
      if (slotHeldRef.current) {
        releaseDraftFrameSlot();
        slotHeldRef.current = false;
      }
      setFrameAllowed(false);
      return;
    }
    let alive = true;
    void acquireDraftFrameSlot().then(() => {
      if (!alive) {
        releaseDraftFrameSlot();
        return;
      }
      slotHeldRef.current = true;
      setFrameAllowed(true);
    });
    return () => {
      alive = false;
      if (slotHeldRef.current) {
        releaseDraftFrameSlot();
        slotHeldRef.current = false;
      }
      setFrameAllowed(false);
    };
  }, [frameSrc, visible]);

  useEffect(() => {
    if (!frameSrc || !visible || !frameAllowed) {
      setFrameReady(false);
      return;
    }
    setFrameReady(false);
    function onMessage(e: MessageEvent) {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const type = e.data && typeof e.data === "object" ? e.data.type : "";
      if (type === "forge:mounted") setFrameReady(true);
    }
    window.addEventListener("message", onMessage);
    const grace = window.setTimeout(() => setFrameReady(true), 12000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(grace);
    };
  }, [frameSrc, visible, frameAllowed]);

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
          {visible && frameAllowed && (
            <div
              className="site-thumb-scaler"
              style={frameReady ? undefined : { visibility: "hidden" }}
            >
              <iframe
                ref={frameRef}
                src={frameSrc}
                title={title || "Preview"}
                tabIndex={-1}
                scrolling="no"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}
          {visible && (!frameAllowed || !frameReady) && (
            <div className="site-thumb-fallback is-loading" />
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
