"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { apiBase, getToken } from "@/lib/api";
import { uploadProjectThumbnail } from "@/lib/project-thumbnail";

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
   * Persisted JPEG from GET /projects/{id}/thumbnail — preferred over live
   * draft capture when the API already has a file.
   */
  imageSrc?: string | null;
  /**
   * When set, a successful live backfill capture is PUT to
   * `/projects/{id}/thumbnail` so the next visit is a cheap img.
   */
  persistProjectId?: string | null;
  /** Fired after a successful persist upload (dashboard flips has_thumbnail). */
  onThumbPersisted?: ((info?: { updated_at?: string }) => void) | null;
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

/**
 * Cap concurrent *successful* live captures per page session. Failed / timed
 * out attempts are refunded so a slow Babel compile does not permanently
 * starve the rest of the grid. Cached snapshots are unaffected.
 */
const MAX_LIVE_CAPTURES = 12;
let liveCapturesUsed = 0;

/** Babel + first paint + html2canvas regularly exceeds 8s on large projects. */
const CAPTURE_GRACE_MS = 32000;

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
    if (mem.length < 3500) {
      SNAP_CACHE.delete(key);
    } else {
      touchSnap(key);
      return mem;
    }
  }
  try {
    const stored = sessionStorage.getItem(SNAP_STORAGE_PREFIX + key);
    if (stored && stored.startsWith("data:image/") && stored.length >= 3500) {
      SNAP_CACHE.set(key, stored);
      touchSnap(key);
      return stored;
    }
    if (stored) sessionStorage.removeItem(SNAP_STORAGE_PREFIX + key);
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

function writeSnap(key: string, dataUrl: string) {
  // Refuse empty/solid placeholders (html2canvas failures used to persist ~1KB JPEGs).
  if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length < 3500) return;
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
  const needsMobileKit = /\.phone\s*\{/i.test(html);
  if (
    html.includes("data-forge-thumb") &&
    (!needsMobileKit || html.includes("data-forge-thumb-mobile-v2"))
  ) {
    return html;
  }
  const css = html.includes("data-forge-thumb")
    ? ""
    : "<style data-forge-thumb>html,body{overflow:hidden!important;scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}</style>";
  // Mobile kit previews: hide side copy + cover-scale the .phone to fill the card.
  const mobileKit =
    needsMobileKit && !html.includes("data-forge-thumb-mobile-v2")
      ? `<style data-forge-thumb-mobile-v2>
html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;background:#111!important;gap:0!important;position:relative!important}
.side{display:none!important}
.phone{width:172px!important;height:288px!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;flex:none!important;transform:scale(2.85);transform-origin:center top}
.notch{display:none!important}
</style>`
      : "";
  const inject = css + mobileKit;
  if (!inject) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${inject}`);
  }
  return inject + html;
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
  imageSrc,
  persistProjectId,
  onThumbPersisted,
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
  const [imageFailed, setImageFailed] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [snapshot, setSnapshot] = useState<string | null>(() =>
    frameSrc && keySnap ? readSnap(keySnap) : null,
  );
  // Live-capture budget exhausted for this card: show the static branded
  // fallback rather than mounting another heavy live iframe.
  const [capped, setCapped] = useState(false);
  /** Bumps when the host ref was missing so the capture effect re-runs. */
  const [hostKick, setHostKick] = useState(0);
  /** Same-origin blob URL — avoids ORB/CSP breakage on localhost↔127.0.0.1 img tags. */
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const persistIdRef = useRef(persistProjectId);
  persistIdRef.current = persistProjectId;
  const onPersistedRef = useRef(onThumbPersisted);
  onPersistedRef.current = onThumbPersisted;

  useEffect(() => {
    setImageFailed(false);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [imageSrc]);

  // Fetch persisted JPEG as a blob so <img> is same-origin, and reject
  // empty/legacy portrait mobile solids so we fall back to live capture.
  useEffect(() => {
    if (!imageSrc || imageFailed) return;
    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      try {
        const res = await fetch(imageSrc);
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 2500) throw new Error("thumbnail_too_small");
        const blob = new Blob([buf], { type: "image/jpeg" });
        const bmp = await createImageBitmap(blob);
        const portraitStale =
          viewportWidth <= 500 && bmp.height > bmp.width * 1.15;
        const tiny = bmp.width < 80 || bmp.height < 80;
        bmp.close();
        if (portraitStale || tiny) throw new Error("thumbnail_stale");
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      } catch {
        if (!cancelled) setImageFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [imageSrc, imageFailed, viewportWidth]);

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

  const usePersistedImage = Boolean(blobUrl && !imageFailed);
  // While validating a persisted JPEG, don't mount a live draft iframe yet.
  const persistChecking = Boolean(imageSrc && !imageFailed && !blobUrl);

  // Live draft → one-at-a-time capture → static image (backfill only).
  useLayoutEffect(() => {
    if (usePersistedImage || persistChecking) return;
    if (!frameSrc || !visible || snapshot || capped) return;

    // Host mounts in the same commit as `visible`; if the ref is still null
    // (edge timing), kick a re-run on the next frame instead of giving up.
    const host = hostRef.current;
    if (!host) {
      const raf = window.requestAnimationFrame(() => setHostKick((k) => k + 1));
      return () => window.cancelAnimationFrame(raf);
    }

    // A cached snapshot may already exist (another mount, or a prior session
    // via sessionStorage) — use it instead of spending budget on a live render.
    const cached = keySnap ? readSnap(keySnap) : null;
    if (cached) {
      setSnapshot(cached);
      const pid = persistIdRef.current;
      if (pid) {
        void uploadProjectThumbnail(pid, cached).then((res) => {
          if (res.ok) onPersistedRef.current?.({ updated_at: res.updated_at });
        });
      }
      return;
    }

    // Budget exhausted: stop rendering live iframes to avoid OOM.
    if (liveCapturesUsed >= MAX_LIVE_CAPTURES) {
      setCapped(true);
      return;
    }

    let cancelled = false;
    let iframe: HTMLIFrameElement | null = null;
    let graceTimer = 0;
    let slotHeld = false;
    let budgetTaken = false;
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

    const refundBudget = () => {
      if (!budgetTaken) return;
      budgetTaken = false;
      liveCapturesUsed = Math.max(0, liveCapturesUsed - 1);
    };

    void (async () => {
      await acquireLiveSlot();
      // Mark held immediately — a Strict Mode cleanup between await and this
      // line used to leak liveSlotBusy=true forever (thumbs stuck loading).
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

      // Budget may have been spent by other cards while we queued.
      if (liveCapturesUsed >= MAX_LIVE_CAPTURES) {
        setCapped(true);
        dropLive();
        return;
      }
      liveCapturesUsed += 1;
      budgetTaken = true;

      iframe = createLiveIframe(frameSrc, title);
      host.replaceChildren(iframe);

      onMessage = (e: MessageEvent) => {
        if (cancelled || !iframe || e.source !== iframe.contentWindow) return;
        const type = e.data && typeof e.data === "object" ? e.data.type : "";
        if (type === "forge:thumb-snapshot" && typeof e.data.dataUrl === "string") {
          const dataUrl = e.data.dataUrl as string;
          if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length < 3500) {
            refundBudget();
            dropLive();
            if (!cancelled) setCapped(true);
            return;
          }
          writeSnap(keySnap, dataUrl);
          setSnapshot(dataUrl);
          // Keep the budget charge — capture succeeded.
          budgetTaken = false;
          dropLive();
          const pid = persistIdRef.current;
          if (pid) {
            void uploadProjectThumbnail(pid, dataUrl).then((res) => {
              if (res.ok) onPersistedRef.current?.({ updated_at: res.updated_at });
            });
          }
        }
      };
      window.addEventListener("message", onMessage);

      // If capture never arrives, drop the live frame, refund budget, and exit
      // the infinite loading shimmer (previous bug: grace cleared the iframe
      // but left snapshot=null forever because the effect did not re-run).
      graceTimer = window.setTimeout(() => {
        refundBudget();
        dropLive();
        if (!cancelled) setCapped(true);
      }, CAPTURE_GRACE_MS);
    })();

    return () => {
      cancelled = true;
      refundBudget();
      dropLive();
    };
  }, [frameSrc, visible, snapshot, capped, keySnap, title, hostKick, usePersistedImage, persistChecking]);

  useEffect(() => {
    let alive = true;
    if (usePersistedImage || persistChecking || frameSrc) return;
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
  }, [src, authPath, key, visible, frameSrc, usePersistedImage, persistChecking]);

  const showLiveCapture = Boolean(
    !usePersistedImage && !persistChecking && frameSrc && !snapshot && visible && !capped,
  );

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
      {usePersistedImage ? (
        <img
          className="site-thumb-snap"
          src={blobUrl!}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : frameSrc ? (
        <>
          {snapshot ? (
            <img className="site-thumb-snap" src={snapshot} alt="" draggable={false} />
          ) : capped ? (
            // Budget spent — static branded placeholder, no pulse (final state).
            <div className="site-thumb-fallback">
              <BrandLogo alt="" width={132} height={38} className="site-thumb-brand" />
            </div>
          ) : (
            <>
              {showLiveCapture && (
                // Do NOT use visibility:hidden — Chromium throttles (or freezes)
                // timers/rAF inside such iframes, so Babel + html2canvas never
                // finish and cards sit on the shimmer until the grace timeout.
                <div className="site-thumb-scaler site-thumb-scaler--capture">
                  <div className="site-thumb-host" ref={hostRef} />
                </div>
              )}
              <div className={`site-thumb-fallback${persistChecking || !snapshot ? " is-loading" : ""}`}>
                <BrandLogo alt="" width={132} height={38} className="site-thumb-brand" />
              </div>
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
        <div className={`site-thumb-fallback ${failed ? "is-failed" : "is-loading"}`}>
          <BrandLogo alt="" width={132} height={38} className="site-thumb-brand" />
        </div>
      )}
    </div>
  );
}
