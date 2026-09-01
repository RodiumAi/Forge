"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { api, setToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

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

    let cancelled = false;
    api<{ access_token: string }>("/auth/rodium/callback", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    })
      .then((data) => {
        if (cancelled) return;
        setToken(data.access_token);
        router.replace("/dashboard");
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
