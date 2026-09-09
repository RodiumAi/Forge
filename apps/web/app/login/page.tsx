"use client";

/**
 * Sign in.
 *
 * "Continue with RodiumAi" stays the primary action — on the hosted instance
 * it is the path that brings a wallet and a generation key with it. Below it
 * sit the options that work without RodiumAi at all: Google and
 * email/password. On a clone the RodiumAi button is hidden (the API answers
 * 503 without an OIDC client id), so the local options become the whole page.
 *
 * `?autostart=1` skips straight to the RodiumAi redirect — that is how the
 * "Forge" card on the RodiumAi dashboard opens the builder in one click.
 * Manual clicks use a centered popup (same shape as Google/Firebase).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard, AuthDivider, AuthField } from "@/components/auth/AuthCard";
import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { CheckInboxNotice } from "@/components/auth/CheckInboxNotice";
import { PasswordField } from "@/components/auth/PasswordField";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { ApiError, api, getToken, setToken } from "@/lib/api";
import { sanitizeReturnTo, startRodiumOAuth } from "@/lib/rodium-oauth";
import { firebaseEnabled } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";

type TokenResponse = { access_token: string; email_verified?: boolean };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /**
   * The password was right but the address is unconfirmed. Held separately
   * from `error` so we can offer the resend rather than just scold.
   */
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  /**
   * Hidden once RodiumAi answers 503 — a clone should not show a button that
   * cannot work. Starts visible so the hosted instance has no flicker.
   */
  const [rodiumAvailable, setRodiumAvailable] = useState(true);

  const autostart = params.get("autostart") === "1";
  const startedRef = useRef(false);

  function land() {
    window.location.assign(sanitizeReturnTo(params.get("next")) || "/dashboard");
  }

  async function loginWithRodium() {
    setRedirecting(true);
    setError(null);
    const result = await startRodiumOAuth({
      returnTo: sanitizeReturnTo(params.get("next")),
      unavailableHref: null,
      mode: autostart ? "redirect" : "popup",
    });
    if (result.ok) {
      // Popup mode navigates the opener; redirect mode leaves this page.
      return;
    }
    if (result.reason === "oidc_unavailable") {
      setRodiumAvailable(false);
      if (autostart) setError(t("loginRodiumOidcUnavailable"));
    } else if (result.reason === "popup_blocked") {
      setError(t("authSocialPopupBlocked"));
    } else if (result.reason === "cancelled") {
      // User closed the popup — not an error worth shouting about.
    } else if (result.error instanceof Error) {
      setError(result.error.message);
    } else if (result.reason === "error") {
      setError(t("errorGeneric"));
    }
    setRedirecting(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(null);
    try {
      const data = await api<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(data.access_token);
      land();
    } catch (err) {
      // 403 on this endpoint means one thing: correct credentials, address not
      // confirmed. Anything else is a real failure.
      if (err instanceof ApiError && err.status === 403) {
        setNeedsVerification(email.trim());
      } else {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autostart || startedRef.current) return;
    startedRef.current = true;
    if (getToken()) {
      router.replace("/dashboard");
      return;
    }
    void loginWithRodium();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot autostart
  }, [autostart, router]);

  if (autostart && !error && rodiumAvailable) {
    return <AuthCallbackScreen />;
  }

  const busy = loading || redirecting;

  if (needsVerification) {
    return (
      <AuthCard
        title={t("authCheckInboxTitle")}
        footer={
          <p className="auth-alt" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="auth-link"
              onClick={() => setNeedsVerification(null)}
            >
              {t("authBackToLogin")}
            </button>
          </p>
        }
      >
        <CheckInboxNotice email={needsVerification} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("loginTitle")} subtitle={t("authLoginSub")} error={error}>
      {rodiumAvailable ? (
        <>
          <button
            className="btn"
            type="button"
            style={{ width: "100%" }}
            disabled={busy}
            onClick={() => void loginWithRodium()}
          >
            {redirecting ? t("loginRodiumRedirecting") : t("loginWithRodium")}
          </button>
          <AuthDivider />
        </>
      ) : null}

      <SocialButtons onSuccess={land} onError={setError} disabled={busy} />
      {firebaseEnabled ? <AuthDivider /> : null}

      <form onSubmit={(e) => void submit(e)}>
        <AuthField id="login-email" label={t("email")}>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            placeholder={t("authEmailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <PasswordField
          id="login-password"
          label={t("password")}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={busy}
        />

        <button className="btn" type="submit" style={{ width: "100%" }} disabled={busy}>
          {loading ? t("authWorking") : t("authSignInCta")}
        </button>
      </form>

      <p className="auth-alt">
        <button
          type="button"
          className="auth-link"
          onClick={() => router.push("/forgot-password")}
        >
          {t("authForgotPassword")}
        </button>
      </p>

      <p className="auth-alt">
        {t("authNoAccount")}{" "}
        <button type="button" className="auth-link" onClick={() => router.push("/register")}>
          {t("authSignUpCta")}
        </button>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthCallbackScreen />}>
      <LoginInner />
    </Suspense>
  );
}
