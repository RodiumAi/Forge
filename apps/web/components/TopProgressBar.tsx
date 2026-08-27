"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  subscribeTopProgress,
  topProgressDone,
  topProgressStart,
} from "@/lib/top-progress";

const ROUTE_KEY = "route";

function isInternalHref(href: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      return new URL(href).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return href.startsWith("/");
}

/** True when the history URL only changes search/hash (builder sync), not the path. */
function isSamePathNavigation(urlArg: unknown): boolean {
  if (typeof urlArg !== "string" || !urlArg) return false;
  try {
    const next = new URL(urlArg, window.location.href);
    return next.pathname === window.location.pathname;
  } catch {
    return false;
  }
}

/**
 * Schedule outside React's commit/insertion phase.
 * Calling setState synchronously from a history.pushState monkey-patch
 * trips "useInsertionEffect must not schedule updates" (Next useSearchParams).
 */
function startRouteProgressDeferred() {
  queueMicrotask(() => topProgressStart(ROUTE_KEY));
}

/**
 * Global activity indicator for route changes and explicit loads (preview,
 * publish, generation…). Renders as a discreet top-right spinner pill: the old
 * full-width top bar suggested a whole-page load on every background action.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState({ active: false, value: 0 });

  useEffect(() => subscribeTopProgress(setState), []);

  // Finish the bar when the App Router settles on a new URL.
  useEffect(() => {
    topProgressDone(ROUTE_KEY);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return;
      if (ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const el = (ev.target as Element | null)?.closest?.("a[href]");
      if (!el) return;
      const a = el as HTMLAnchorElement;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || !isInternalHref(href)) return;
      const url = href.startsWith("http")
        ? new URL(href)
        : new URL(href, window.location.origin);
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      // Path-only navigations show progress; query-only builder sync does not.
      if (url.pathname === window.location.pathname) return;
      startRouteProgressDeferred();
    };

    // Catch Next.js client navigations (router.push / replace).
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      // Builder URL sync (page=, viewport=, pane=) must not flash the loader
      // or setState during Next's useSearchParams insertion phase.
      if (!isSamePathNavigation(args[2])) startRouteProgressDeferred();
      return origPush(...args);
    };
    history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      if (!isSamePathNavigation(args[2])) startRouteProgressDeferred();
      return origReplace(...args);
    };

    const onPop = () => startRouteProgressDeferred();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  const visible = state.active || state.value > 0;
  if (!visible) return null;

  return (
    <div
      className={`forge-top-loader${state.value >= 1 ? " is-done" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="forge-top-loader-spinner" />
    </div>
  );
}
