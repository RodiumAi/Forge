"use client";

/**
 * "Open Forge" landing from the RodiumAi dashboard — see `lib/rodium-handoff`.
 *
 * Without a fragment this page starts the handoff (tab secret → dashboard);
 * with `#code=…` it finishes it. A code that reaches a tab which did not ask
 * for it restarts the handoff once, so the browser signs in as whoever is
 * signed in on RodiumAi here — never as the person who shared the link.
 *
 * Strict Mode remounts after `replaceState` clears the hash. A search+hash
 * "run once" key would then look like a fresh start and abort the in-flight
 * finish — which is the redirect loop we saw in production. Phase guards
 * keep start/finish mutually exclusive for the life of this JS module.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  HANDOFF_PATH,
  finishRodiumHandoff,
  parseHandoffFragment,
  startRodiumHandoff,
} from "@/lib/rodium-handoff";
import { sanitizeReturnTo } from "@/lib/rodium-oauth";

/** Survives Strict Mode remounts within the same document / soft navigations. */
type HandoffPhase = "idle" | "starting" | "finishing";
let phase: HandoffPhase = "idle";

/**
 * Dashboard round-trip drops `?retry=1`, so the second finish attempt would
 * look like a first failure and loop forever. Persist across that bounce.
 */
const RETRY_STORAGE_KEY = "forge_handoff_retry";

function readRetried(params: URLSearchParams): boolean {
  if (params.get("retry") === "1") return true;
  try {
    return sessionStorage.getItem(RETRY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markRetried(): void {
  try {
    sessionStorage.setItem(RETRY_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

function clearRetried(): void {
  try {
    sessionStorage.removeItem(RETRY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function restartPath(next: string | null): string {
  const qs = new URLSearchParams({ retry: "1" });
  const safe = sanitizeReturnTo(next);
  if (safe) qs.set("next", safe);
  return `${HANDOFF_PATH}?${qs}`;
}

function HandoffInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = parseHandoffFragment(window.location.hash);
    const retried = readRetried(params);

    if (fragment.code) {
      if (phase === "finishing") return;
      phase = "finishing";

      // Drop the code from the address bar and history before anything else.
      window.history.replaceState(null, "", HANDOFF_PATH);
      finishRodiumHandoff(fragment)
        .then((dest) => {
          clearRetried();
          router.replace(dest);
        })
        .catch(() => {
          if (!retried) {
            markRetried();
            window.location.replace(restartPath(fragment.next));
            return;
          }
          clearRetried();
          setError(t("handoffExpired"));
        });
      return;
    }

    // After replaceState, Strict Mode remounts with an empty hash — do not
    // start a second handoff while finish is still running.
    if (phase !== "idle") return;
    phase = "starting";

    void startRodiumHandoff(params.get("next")).then((result) => {
      window.location.replace(result.url);
    });
  }, [params, router, t]);

  return (
    <AuthCallbackScreen
      error={error}
      onRetry={error ? () => router.push("/login?autostart=1") : undefined}
    />
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={<AuthCallbackScreen />}>
      <HandoffInner />
    </Suspense>
  );
}
