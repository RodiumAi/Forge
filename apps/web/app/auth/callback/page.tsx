"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { api, setToken } from "@/lib/api";
import { consumeStateBinding } from "@/lib/oauth-state";
import {
  consumeOAuthReturnTo,
  finishOAuthPopup,
  isOAuthPopupWindow,
} from "@/lib/rodium-oauth";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Survive React Strict Mode's mount → unmount → remount. A component `useRef`
 * resets on remount, so the old guard still burned `state_binding` twice and
 * the second call hit the API with `null` → "OAuth state does not match".
 */
const inflightCallbacks = new Map<string, Promise<{ access_token: string }>>();

function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<{ access_token: string }> {
  const key = `${code}:${state}`;
  const existing = inflightCallbacks.get(key);
  if (existing) return existing;

  const stateBinding = consumeStateBinding();
  const promise = api<{ access_token: string }>("/auth/rodium/callback", {
    method: "POST",
    body: JSON.stringify({ code, state, state_binding: stateBinding }),
  }).finally(() => {
    // Keep long enough for Strict Mode remount to join the same promise.
    window.setTimeout(() => inflightCallbacks.delete(key), 5_000);
  });
  inflightCallbacks.set(key, promise);
  return promise;
}

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
    const asPopup = isOAuthPopupWindow();

    exchangeOAuthCode(code, state)
      .then(async (data) => {
        if (cancelled) return;
        setToken(data.access_token);
        try {
          const { prepareSessionAfterRodiumLogin } = await import(
            "@/lib/session-cache"
          );
          await prepareSessionAfterRodiumLogin();
        } catch {
          // Session hydrate is best-effort; dashboard will refresh again.
        }
        if (cancelled) return;
        if (asPopup) {
          finishOAuthPopup();
          return;
        }
        const returnTo = consumeOAuthReturnTo();
        router.replace(returnTo || "/dashboard");
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
      onRetry={
        error
          ? () => {
              if (isOAuthPopupWindow()) {
                window.close();
                return;
              }
              router.push("/login");
            }
          : undefined
      }
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
