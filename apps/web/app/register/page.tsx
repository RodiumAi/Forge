"use client";

/**
 * Create a Forge account.
 *
 * This route used to be a redirect to `/login`, because there was no way to
 * create an account at all — sign-in went exclusively through the RodiumAi
 * OIDC provider, which is not part of this repository. It is a real form now,
 * so a clone is usable on its own.
 *
 * Registration ends on "check your inbox", not in the builder. An account
 * whose address is unconfirmed has no RodiumAi account behind it — no wallet,
 * no generation key — so signing someone straight in would show them an empty
 * product. Confirming the link is what provisions all of it.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard, AuthDivider, AuthField } from "@/components/auth/AuthCard";
import { CheckInboxNotice } from "@/components/auth/CheckInboxNotice";
import { PasswordField } from "@/components/auth/PasswordField";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { api, getToken } from "@/lib/api";
import { firebaseEnabled } from "@/lib/firebase";
import { sanitizeReturnTo } from "@/lib/rodium-oauth";
import { useI18n } from "@/lib/i18n/I18nProvider";

type RegistrationResponse = { email: string; message?: string | null };

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  const invited = (params.get("email") || "").trim().toLowerCase();
  const lockedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invited) ? invited : "";

  const [email, setEmail] = useState(lockedEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(lockedEmail ? lockedEmail.split("@")[0] : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Set once the account exists; swaps the form for the inbox notice. */
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  useEffect(() => {
    if (lockedEmail) {
      setEmail(lockedEmail);
      setName((current) => current || lockedEmail.split("@")[0]);
    }
  }, [lockedEmail]);

  useEffect(() => {
    if (getToken()) {
      router.replace(sanitizeReturnTo(params.get("next")) || "/dashboard");
    }
  }, [router, params]);

  function goToLogin() {
    const next = sanitizeReturnTo(params.get("next"));
    router.push(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  function land() {
    // Hard navigation: the landing page stashed a pending prompt in
    // sessionStorage and the dashboard replays it on mount.
    window.location.assign(sanitizeReturnTo(params.get("next")) || "/dashboard");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t("authPasswordTooShort"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<RegistrationResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      // No token comes back on purpose — see the file header.
      setRegisteredEmail(data.email || email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <AuthCard
        title={t("authCheckInboxTitle")}
        footer={
          <p className="auth-alt" style={{ marginTop: 0 }}>
            <button type="button" className="auth-link" onClick={goToLogin}>
              {t("authBackToLogin")}
            </button>
          </p>
        }
      >
        <CheckInboxNotice email={registeredEmail} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("registerTitle")} subtitle={t("authRegisterSub")} error={error}>
      {lockedEmail ? null : <SocialButtons onSuccess={land} onError={setError} disabled={loading} />}
      {firebaseEnabled && !lockedEmail ? <AuthDivider /> : null}

      <form onSubmit={(e) => void submit(e)}>
        <AuthField id="register-email" label={t("email")}>
          <input
            id="register-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            readOnly={Boolean(lockedEmail)}
            aria-readonly={Boolean(lockedEmail)}
            placeholder={t("authEmailPlaceholder")}
            value={email}
            onChange={(e) => {
              if (!lockedEmail) setEmail(e.target.value);
            }}
          />
          {lockedEmail ? <small className="auth-email-lock">{t("teamJoinEmailLocked")}</small> : null}
        </AuthField>

        <AuthField id="register-name" label={t("authNameLabel")}>
          <input
            id="register-name"
            className="input"
            type="text"
            autoComplete="name"
            required
            placeholder={t("authNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </AuthField>

        <PasswordField
          id="register-password"
          label={t("password")}
          autoComplete="new-password"
          minLength={8}
          placeholder={t("authPasswordPlaceholder")}
          value={password}
          onChange={setPassword}
          disabled={loading}
        />

        <button className="btn" type="submit" style={{ width: "100%" }} disabled={loading}>
          {loading ? t("authWorking") : t("authSignUpCta")}
        </button>
      </form>

      <p className="auth-alt">
        {t("authHaveAccount")}{" "}
        <button type="button" className="auth-link" onClick={goToLogin}>
          {t("authSignInCta")}
        </button>
      </p>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
