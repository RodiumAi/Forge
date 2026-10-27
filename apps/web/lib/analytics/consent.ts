import { useCallback, useSyncExternalStore } from "react";

/**
 * Analytics consent (product analytics and audience measurement).
 *
 * Nothing optional is loaded, stored or sent until the visitor chooses
 * "granted". The choice itself is the only thing stored before that, and it is
 * strictly necessary to honour the choice, so it needs no consent.
 */
export type AnalyticsConsent = "granted" | "denied";

export const ANALYTICS_CONSENT_KEY = "rodium_analytics_consent_v1";
const CHANGE_EVENT = "rodium:analytics-consent";

/** Fallback when the browser blocks storage: the choice then lasts for the page session only. */
let memoryValue: AnalyticsConsent | null = null;

function parse(raw: string | null): AnalyticsConsent | null {
  return raw === "granted" || raw === "denied" ? raw : null;
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)) ?? memoryValue;
  } catch {
    return memoryValue;
  }
}

export function writeAnalyticsConsent(value: AnalyticsConsent | null): void {
  if (typeof window === "undefined") return;
  memoryValue = value;
  try {
    if (value === null) {
      window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    } else {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    }
  } catch {
    // Storage blocked: the in-memory value above keeps this session consistent.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAnalyticsConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ANALYTICS_CONSENT_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export type AnalyticsConsentState = {
  /** `undefined` until the browser state is known (server render and first paint). */
  consent: AnalyticsConsent | null | undefined;
  grant: () => void;
  deny: () => void;
  /** Forget the choice so the banner is shown again. */
  reset: () => void;
};

export function useAnalyticsConsent(): AnalyticsConsentState {
  const consent = useSyncExternalStore<AnalyticsConsent | null | undefined>(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    () => undefined,
  );
  const grant = useCallback(() => writeAnalyticsConsent("granted"), []);
  const deny = useCallback(() => writeAnalyticsConsent("denied"), []);
  const reset = useCallback(() => writeAnalyticsConsent(null), []);
  return { consent, grant, deny, reset };
}

/** Test seam: clears the in-memory fallback. */
export function resetAnalyticsConsentMemoryForTests(): void {
  memoryValue = null;
}
