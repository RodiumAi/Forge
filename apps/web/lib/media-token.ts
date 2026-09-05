/**
 * Short-lived credential for resources the browser loads directly.
 *
 * `<img src>` and iframes cannot set an Authorization header, so their token
 * travels in the query string — and from there into access logs, and into
 * `Referer` on any cross-origin load. Putting the 7-day session JWT there gave
 * anyone with log access a full-API credential.
 *
 * So those loads use a separate token: read-only, one hour, refused by every
 * route except the four that a browser fetches directly. The worst a leaked
 * log line now yields is an hour of read access to that user's own assets.
 *
 * Read synchronously
 * ------------------
 * The URL builders (`lib/asset-url.ts`) are called during render and return a
 * string, so this cache is deliberately synchronous. `primeMediaToken()` fills
 * it — call it once where a page mounts. Before it resolves the builders return
 * null, which every call site already treats as "no image yet"; a `mediatoken`
 * event then re-renders the subscribers.
 */

"use client";

import { useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";

const STORAGE_KEY = "forge_media_token_v1";
/** Refresh well before the server's 60-minute expiry. */
const REFRESH_AFTER_MS = 45 * 60 * 1000;
export const MEDIA_TOKEN_EVENT = "forge:mediatoken";

type Cached = { token: string; issuedAt: number };

let cache: Cached | null = null;
let inFlight: Promise<string | null> | null = null;

function readStorage(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return typeof parsed?.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(value: Cached | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — the in-memory cache still works for this tab */
  }
}

function isFresh(value: Cached | null): value is Cached {
  return !!value && Date.now() - value.issuedAt < REFRESH_AFTER_MS;
}

/** The cached token, or null when one has not been fetched yet. */
export function getMediaToken(): string | null {
  if (isFresh(cache)) return cache.token;
  cache = readStorage();
  return isFresh(cache) ? cache.token : null;
}

/**
 * Ensure a token exists, fetching one if needed. Safe to call repeatedly —
 * concurrent callers share a single request.
 */
export async function primeMediaToken(): Promise<string | null> {
  if (typeof window === "undefined" || !getToken()) return null;
  const existing = getMediaToken();
  if (existing) return existing;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const data = await api<{ token: string }>("/auth/media-token", {
        method: "POST",
      });
      cache = { token: data.token, issuedAt: Date.now() };
      writeStorage(cache);
      // Components that rendered before the token arrived can now build their
      // URLs; without this an avatar or thumbnail would stay blank until an
      // unrelated re-render happened to come along.
      window.dispatchEvent(new Event(MEDIA_TOKEN_EVENT));
      return cache.token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Drop the token — on sign-out, and after anything that revokes sessions. */
export function clearMediaToken() {
  cache = null;
  writeStorage(null);
}

/**
 * Token for components that build URLs during render.
 *
 * Primes on mount and re-renders when the token lands, so a thumbnail or
 * avatar that mounted before the fetch resolved does not sit on its fallback
 * forever. Components that only need it inside an event handler can call
 * `getMediaToken()` directly.
 */
export function useMediaToken(): string | null {
  const [token, setTokenState] = useState<string | null>(() => getMediaToken());

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) setTokenState(getMediaToken());
    };
    window.addEventListener(MEDIA_TOKEN_EVENT, sync);
    void primeMediaToken().then(sync);
    return () => {
      cancelled = true;
      window.removeEventListener(MEDIA_TOKEN_EVENT, sync);
    };
  }, []);

  return token;
}
