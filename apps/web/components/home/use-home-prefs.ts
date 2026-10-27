"use client";

/**
 * Per-user preferences of the home kept in the browser: favourite projects and
 * the last time each project was opened from here.
 *
 * There is no API for either yet, so they live in localStorage, keyed by the
 * account so two people on one browser do not share stars. Everything goes
 * through the small store below; moving it server-side later means changing
 * `read`/`write` only, the hooks and components stay as they are.
 */

import { useCallback, useEffect, useState } from "react";

const FAVORITES_PREFIX = "forge_home_favorites_v1";
const OPENED_PREFIX = "forge_home_opened_v1";
const EVENT = "forge-home-prefs";

function storageKey(prefix: string, account: string | null | undefined): string {
  return `${prefix}:${(account || "anonymous").trim().toLowerCase()}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or denied: the star still toggles for this page view */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** Re-read `key` whenever this tab or another one writes it. */
function useStored<T>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(read(key, fallback));
    const sync = (event: Event) => {
      const changed = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (changed === key) setValue(read(key, fallback));
    };
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a fresh literal each render
  }, [key]);
  const update = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );
  return [value, update];
}

export type Favorites = {
  ids: ReadonlySet<string>;
  isFavorite: (projectId: string) => boolean;
  toggle: (projectId: string) => void;
};

export function useFavorites(account: string | null | undefined): Favorites {
  const [list, setList] = useStored<string[]>(storageKey(FAVORITES_PREFIX, account), []);
  const ids = new Set(Array.isArray(list) ? list : []);
  return {
    ids,
    isFavorite: (projectId) => ids.has(projectId),
    toggle: (projectId) => {
      const next = new Set(ids);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      setList([...next]);
    },
  };
}

export type LastOpened = {
  /** ISO time this browser last opened the project from the home, if ever. */
  get: (projectId: string) => string | null;
  record: (projectId: string) => void;
};

export function useLastOpened(account: string | null | undefined): LastOpened {
  const [map, setMap] = useStored<Record<string, string>>(storageKey(OPENED_PREFIX, account), {});
  return {
    get: (projectId) => (map && typeof map[projectId] === "string" ? map[projectId] : null),
    record: (projectId) => setMap({ ...(map || {}), [projectId]: new Date().toISOString() }),
  };
}

/** A small persisted UI choice (view mode, collapsed grid), not tied to the account. */
export function useHomeSetting<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useStored<string>(`forge_home_${key}`, fallback);
  const safe = (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  return [safe, setValue as (next: T) => void];
}
