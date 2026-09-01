const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/+$/, "") ||
  "https://eu.i.posthog.com";

export const posthogEnabled =
  process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true" && POSTHOG_KEY.length > 0;

export const posthogApp = "forge" as const;

export function posthogEnvironment(): string {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

let initialized = false;
let initPromise: Promise<typeof import("posthog-js").default | null> | null =
  null;

export async function getPostHog() {
  if (!posthogEnabled || typeof window === "undefined") return null;
  if (!initPromise) {
    initPromise = import("posthog-js").then(({ default: posthog }) => {
      if (!initialized) {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          person_profiles: "identified_only",
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
        initialized = true;
      }
      return posthog;
    });
  }
  return initPromise;
}

export function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!posthogEnabled) return;
  void getPostHog().then((client) => {
    client?.capture(event, {
      app: posthogApp,
      environment: posthogEnvironment(),
      ...properties,
    });
  });
}

export function identifyPosthogUser(
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (!posthogEnabled || !distinctId) return;
  void getPostHog().then((client) => {
    client?.identify(distinctId, {
      app: posthogApp,
      environment: posthogEnvironment(),
      ...properties,
    });
  });
}

export function resetPosthogUser() {
  if (!posthogEnabled) return;
  void getPostHog().then((client) => {
    client?.reset();
  });
}
