"use client";

import { useEffect } from "react";
import { getPostHog } from "@/lib/posthog/client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void getPostHog();
  }, []);

  return <>{children}</>;
}
