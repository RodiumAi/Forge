"use client";

import { useEffect } from "react";
import { useAnalyticsConsent } from "@/lib/analytics/consent";
import { getPostHog } from "@/lib/posthog/client";

/**
 * Loads PostHog only once the visitor has accepted analytics. Until then no
 * script is fetched, nothing is stored and nothing is sent.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== "granted") return;
    void getPostHog();
  }, [consent]);

  return <>{children}</>;
}
