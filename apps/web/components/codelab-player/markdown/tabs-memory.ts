/**
 * Remembered tab choice per group ("Python" picked once, Python everywhere).
 *
 * Stored in localStorage under `<storageKey>:tabs:<group>` and broadcast in
 * the page so every tab group of the same group switches together. Storage
 * may be unavailable (private mode, blocked site data): the choice then lives
 * for the page only.
 */

const EVENT = "forge-codelab-tab";
const memory = new Map<string, string>();

function key(storageKey: string, group: string): string {
  return `${storageKey}:tabs:${group}`;
}

export function readTabChoice(storageKey: string, group: string): string | null {
  const k = key(storageKey, group);
  if (memory.has(k)) return memory.get(k)!;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function writeTabChoice(storageKey: string, group: string, label: string): void {
  const k = key(storageKey, group);
  memory.set(k, label);
  try {
    window.localStorage.setItem(k, label);
  } catch {
    // page memory only
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: k, label } }));
  }
}

export function onTabChoice(storageKey: string, group: string, listener: (label: string) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const k = key(storageKey, group);
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string; label: string }>).detail;
    if (detail?.key === k) listener(detail.label);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** For tests. */
export function resetTabMemory(): void {
  memory.clear();
}
