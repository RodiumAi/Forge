"use client";

/**
 * Land here from the confirmation email.
 *
 * The link is consumed on mount and the server hands back a session token, so
 * opening it in a different browser than the one that signed up still leaves
 * the visitor signed in. The `startedRef` guard matters: React Strict Mode
 * runs effects twice in development and the link only works once.
 *
 * When the link is expired or already used, we keep the raw token and offer
 * "Resend", the API looks the address up from that token so the visitor does
 * not bounce to login just to request another mail.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthAlert, AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { ApiError, api, setToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type TokenResponse = { access_token: string };
type Phase = "working" | "ok" | "failed" | "network_error";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  const token = params.get("token") ?? "";
  const [phase, setPhase] = useState<Phase>(token ? "working" : "failed");
  const [attempt, setAttempt] = useState(0);
  const [resent, setResent] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const data = await api<TokenResponse>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        setToken(data.access_token);
        setPhase("ok");
      } catch (err) {
        if (err instanceof ApiError) {
          setPhase("failed");
        } else {
          setPhase("network_error");
        }
      }
    })();
  }, [token, attempt]);

  async function resendFromToken() {
    if (!token || resendBusy) return;
    setResendBusy(true);
    try {
      await api("/auth/verify-email/resend", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    } catch {
      // Endpoint always reports success for known/unknown; network blips still
      // surface the optimistic "sent" state so the visitor checks their inbox.
    } finally {
      setResent(true);
      setResendBusy(false);
    }
  }

  if (phase === "working") {
    return (
      <AuthCard title={t("authVerifyTitle")} subtitle={t("lndAuthWorkingHint")} icon="spinner" />
    );
  }

  if (phase === "ok") {
    return (
      <AuthCard title={t("authVerifyOkTitle")} subtitle={t("authVerifyOkBody")} icon="check" tone="ok">
        <Button size="lg" block iconEnd="arrow-right" onClick={() => window.location.assign("/dashboard")}>
          {t("authVerifyGoToForge")}
        </Button>
      </AuthCard>
    );
  }

  if (phase === "network_error") {
    return (
      <AuthCard
        title={t("authVerifyNetworkTitle")}
        subtitle={t("authVerifyNetworkBody")}
        icon="signal"
        tone="danger"
        footer={
          <p className="f-auth-alt">
            <AuthLink onClick={() => router.push("/login")}>{t("authBackToLogin")}</AuthLink>
          </p>
        }
      >
        <Button
          size="lg"
          block
          icon="refresh"
          onClick={() => {
            startedRef.current = false;
            setPhase("working");
            setAttempt((n) => n + 1);
          }}
        >
          {t("authVerifyRetry")}
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("authVerifyFailTitle")}
      subtitle={t("authVerifyFailBody")}
      icon="clock"
      tone="danger"
      footer={
        <p className="f-auth-alt">
          <AuthLink onClick={() => router.push("/login")}>{t("authVerifyTryLogin")}</AuthLink>
        </p>
      }
    >
      {resent ? (
        <AuthAlert tone="ok">{t("authVerifyResendDone")}</AuthAlert>
      ) : token ? (
        <Button size="lg" block icon="send" loading={resendBusy} onClick={() => void resendFromToken()}>
          {resendBusy ? t("authWorking") : t("authVerifyResend")}
        </Button>
      ) : null}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
