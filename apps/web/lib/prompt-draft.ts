"use client";

import { useEffect, useRef } from "react";

/**
 * Prompt drafts kept in localStorage, so a reload (deploy, crash, closed tab)
 * does not wipe what the user was typing. One draft per field key; drafts expire
 * after a week; a blocked storage (private mode) just turns the feature off.
 */

export type PromptDraft = {
  text: string;
  /** Free-form extras of the field (tags, uploaded files, picked tile...). */
  extras?: Record<string, unknown>;
  savedAt: number;
};

const PREFIX = "forge.draft.";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 300;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isEmpty(draft: Omit<PromptDraft, "savedAt">): boolean {
  if (draft.text.trim()) return false;
  return !Object.values(draft.extras || {}).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
}

export function readPromptDraft(key: string, now = Date.now()): PromptDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PromptDraft;
    if (typeof parsed?.text !== "string" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > DRAFT_TTL_MS) {
      store.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes it when the field is empty. */
export function writePromptDraft(key: string, draft: Omit<PromptDraft, "savedAt">, now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    if (isEmpty(draft)) store.removeItem(PREFIX + key);
    else store.setItem(PREFIX + key, JSON.stringify({ ...draft, savedAt: now }));
  } catch {
    // Quota or blocked storage: the field keeps working, without the draft.
  }
}

export function clearPromptDraft(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Drops expired drafts of every field (called once per page load). */
export function pruneExpiredDrafts(now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
    for (const k of keys) readPromptDraft(k, now);
  } catch {
    // ignore
  }
}

/**
 * Restores the draft of `key` once (when `key` is set), then saves `draft` as
 * it changes, debounced, and again when the page is hidden or unloaded.
 *
 * `pausedRef`: true while a message is on its way, so the field emptied by the
 * send does not erase the draft before the server accepted it; the caller
 * clears the draft on acceptance.
 */
export function usePromptDraft({
  key,
  draft,
  onRestore,
  pausedRef,
}: {
  key: string | null;
  draft: Omit<PromptDraft, "savedAt">;
  onRestore: (draft: PromptDraft) => void;
  pausedRef?: { readonly current: boolean };
}): void {
  const restoredKey = useRef<string | null>(null);
  const latest = useRef(draft);
  latest.current = draft;
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const serialized = JSON.stringify(draft);

  useEffect(() => {
    if (!key || restoredKey.current === key) return;
    restoredKey.current = key;
    pruneExpiredDrafts();
    const saved = readPromptDraft(key);
    if (saved) restore.current(saved);
  }, [key]);

  useEffect(() => {
    if (!key || restoredKey.current !== key) return;
    if (pausedRef?.current) return;
    const timer = window.setTimeout(() => {
      if (!pausedRef?.current) writePromptDraft(key, latest.current);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, serialized, pausedRef]);

  useEffect(() => {
    if (!key) return;
    const flush = () => {
      if (restoredKey.current !== key || pausedRef?.current) return;
      writePromptDraft(key, latest.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, pausedRef]);
}
