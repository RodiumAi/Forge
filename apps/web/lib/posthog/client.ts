import type { CaptureResult, PostHog } from "posthog-js";
import {
  readAnalyticsConsent,
  subscribeAnalyticsConsent,
} from "@/lib/analytics/consent";
import { sanitizeCaptureResult } from "@/lib/analytics/sanitize-event";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/+$/, "") ||
  "https://eu.i.posthog.com";

/** PostHog is configured for this build (key present and explicitly enabled). */
export const posthogEnabled =
  process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true" && POSTHOG_KEY.length > 0;

export const posthogApp = "forge" as const;

export function posthogEnvironment(): string {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

const LOCAL_HOSTNAME = /^(localhost|127\.0\.0\.1|\[::1\]|::1|.*\.localhost)$/i;

/**
 * Local development and end-to-end runs must not pollute the production
 * project. Set NEXT_PUBLIC_POSTHOG_ALLOW_LOCAL=true to test the integration.
 */
function runsOnAllowedHost(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_POSTHOG_ALLOW_LOCAL === "true") return true;
  return !LOCAL_HOSTNAME.test(window.location.hostname);
}

/** Session replay stays off unless explicitly switched on for a build. */
const replayEnabled = process.env.NEXT_PUBLIC_POSTHOG_REPLAY === "true";

/** True only when PostHog is configured, allowed on this host, and the visitor consented. */
export function posthogActive(): boolean {
  return (
    posthogEnabled &&
    runsOnAllowedHost() &&
    readAnalyticsConsent() === "granted"
  );
}

/** Adds the product context to every event, including autocapture, vitals and exceptions. */
function withContext(result: CaptureResult | null): CaptureResult | null {
  const sanitized = sanitizeCaptureResult(result);
  if (!sanitized) return null;
  sanitized.properties = {
    app: posthogApp,
    environment: posthogEnvironment(),
    ...sanitized.properties,
  };
  return sanitized;
}

let initPromise: Promise<PostHog> | null = null;
let consentSubscribed = false;
let identifiedDistinctId: string | null = null;
/** Kept in memory only (never sent) so an identity known before consent is applied right after it. */
let pendingIdentity: {
  distinctId: string;
  properties?: Record<string, unknown>;
} | null = null;

function applyPendingIdentity(client: PostHog): void {
  if (!pendingIdentity || identifiedDistinctId === pendingIdentity.distinctId) {
    return;
  }
  identifiedDistinctId = pendingIdentity.distinctId;
  client.identify(pendingIdentity.distinctId, pendingIdentity.properties);
}

function syncConsent(client: PostHog): void {
  if (readAnalyticsConsent() === "granted") {
    client.opt_in_capturing({ captureEventName: false });
  } else {
    client.opt_out_capturing();
    // Opting out wipes the SDK identity: identify again after a later opt-in.
    identifiedDistinctId = null;
  }
}

/**
 * Lazy-loads posthog-js. Nothing is downloaded, stored or sent before the
 * visitor grants analytics consent: until then this resolves to null.
 */
export async function getPostHog(): Promise<PostHog | null> {
  if (!posthogActive()) return null;
  if (!initPromise) {
    initPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        disable_session_recording: !replayEnabled,
        autocapture: { dom_event_allowlist: ["click", "submit"] },
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
        before_send: withContext,
      });
      return posthog;
    });
  }
  const client = await initPromise;
  if (!consentSubscribed) {
    consentSubscribed = true;
    subscribeAnalyticsConsent(() => syncConsent(client));
  }
  // Consent can have been withdrawn while the library was loading.
  if (!posthogActive()) return null;
  applyPendingIdentity(client);
  return client;
}

export function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!posthogActive()) return;
  void getPostHog().then((client) => {
    client?.capture(event, properties);
  });
}

/**
 * Links the browser to the account. Called once per account: repeating it
 * re-sends person properties as extra billable events.
 */
export function identifyPosthogUser(
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (!posthogEnabled || !distinctId) return;
  pendingIdentity = { distinctId, properties };
  if (!posthogActive()) return;
  void getPostHog();
}

export function resetPosthogUser() {
  identifiedDistinctId = null;
  pendingIdentity = null;
  if (!posthogActive()) return;
  void getPostHog().then((client) => {
    if (!client) return;
    client.reset();
    // reset() clears the SDK consent flags: restore ours right after.
    syncConsent(client);
  });
}
