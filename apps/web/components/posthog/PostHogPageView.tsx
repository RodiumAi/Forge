"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { capturePosthogEvent, posthogEnabled } from "@/lib/posthog/client";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!posthogEnabled || !pathname) return;

    const qs = searchParams.toString();
    const pagePath = qs ? `${pathname}?${qs}` : pathname;
    if (pagePath === lastPath.current) return;
    lastPath.current = pagePath;

    capturePosthogEvent("page_view", {
      page_path: pagePath,
      page_url: typeof window !== "undefined" ? window.location.href : pagePath,
    });
  }, [pathname, searchParams]);

  return null;
}
