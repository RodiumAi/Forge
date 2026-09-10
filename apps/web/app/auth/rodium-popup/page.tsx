"use client";

/**
 * OIDC kick-off that runs *inside* the centered popup.
 *
 * The state-binding secret lives in this window's sessionStorage, so the
 * authorize → callback round-trip must stay here (not in the opener).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { beginRodiumOAuthInPopup } from "@/lib/rodium-oauth";
import { useI18n } from "@/lib/i18n/I18nProvider";

function RodiumPopupInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const prompt = params.get("prompt") || "login";

    void beginRodiumOAuthInPopup({ prompt }).then((result) => {
      if (result.ok) return;
      if (result.reason === "oidc_unavailable") {
        setError(t("loginRodiumOidcUnavailable"));
        return;
      }
      setError(
        result.error instanceof Error ? result.error.message : t("errorGeneric"),
      );
    });
  }, [params, t]);

  return (
    <AuthCallbackScreen
      error={error}
      onRetry={
        error
          ? () => {
              window.close();
            }
          : undefined
      }
    />
  );
}

export default function RodiumPopupPage() {
  return (
    <Suspense fallback={<AuthCallbackScreen />}>
      <RodiumPopupInner />
    </Suspense>
  );
}
