"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { api, setToken } from "@/lib/api";
import { consumeStateBinding } from "@/lib/oauth-state";
import { consumeOAuthReturnTo } from "@/lib/rodium-oauth";
import { useI18n } from "@/lib/i18n/I18nProvider";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  // React Strict Mode remounts effects twice; an OIDC code is single-use.
  const startedRef = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    if (oauthError) {
      setError(params.get("error_description") || oauthError);
      return;
    }
    if (!code || !state) {
      setError(t("loginRodiumMissingCode"));
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    // Burn the secret this browser stashed before the redirect. The server
    // refuses the state unless its hash matches, which is what stops someone
    // else's captured state from completing a sign-in here.
    const stateBinding = consumeStateBinding();
    api<{ access_token: string }>("/auth/rodium/callback", {
      method: "POST",
      body: JSON.stringify({ code, state, state_binding: stateBinding }),
    })
      .then(async (data) => {
        if (cancelled) return;
        setToken(data.access_token);
        try {
          const { ensureSession } = await import("@/lib/session-cache");
          await ensureSession({ force: true });
        } catch {
          // Session hydrate is best-effort; dashboard will refresh again.
        }
        if (!cancelled) {
          const returnTo = consumeOAuthReturnTo();
          router.replace(returnTo || "/dashboard");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      });

    return () => {
      cancelled = true;
    };
  }, [params, router, t]);

  return (
    <AuthCallbackScreen
      error={error}
      onRetry={error ? () => router.push("/login") : undefined}
    />
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackScreen />}>
      <CallbackInner />
    </Suspense>
  );
}
