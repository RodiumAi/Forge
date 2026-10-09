"use client";

/**
 * "Open Forge" landing from the RodiumAi dashboard — see `lib/rodium-handoff`.
 *
 * Without a fragment this page starts the handoff (tab secret → dashboard);
 * with `#code=…` it finishes it. A code that reaches a tab which did not ask
 * for it restarts the handoff once, so the browser signs in as whoever is
 * signed in on RodiumAi here — never as the person who shared the link.
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

/** Strict Mode mounts twice; the handoff must run once per page load. */
let runningFor: string | null = null;

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
    const key = `${window.location.search}${window.location.hash}`;
    if (runningFor === key) return;
    runningFor = key;

    const fragment = parseHandoffFragment(window.location.hash);
    const retried = params.get("retry") === "1";

    if (!fragment.code) {
      void startRodiumHandoff(params.get("next")).then((result) => {
        window.location.replace(result.url);
      });
      return;
    }

    // Drop the code from the address bar and history before anything else.
    window.history.replaceState(null, "", HANDOFF_PATH);
    finishRodiumHandoff(fragment)
      .then((dest) => router.replace(dest))
      .catch(() => {
        if (!retried) {
          window.location.replace(restartPath(fragment.next));
          return;
        }
        setError(t("handoffExpired"));
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
