"use client";

/**
 * Create a Forge account.
 *
 * This route used to be a redirect to `/login`, because there was no way to
 * create an account at all, sign-in went exclusively through the RodiumAi
 * OIDC provider, which is not part of this repository. It is a real form now,
 * so a clone is usable on its own.
 *
 * Registration ends on "check your inbox", not in the builder. An account
 * whose address is unconfirmed has no RodiumAi account behind it, no wallet,
 * no generation key, so signing someone straight in would show them an empty
 * product. Confirming the link is what provisions all of it.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard, AuthDivider, AuthField, AuthLink } from "@/components/auth/AuthCard";
import { CheckInboxNotice } from "@/components/auth/CheckInboxNotice";
import { PasswordField } from "@/components/auth/PasswordField";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { Input } from "@/components/ui/Input";
import { api, getToken } from "@/lib/api";
import {
  MIN_PASSWORD,
  emailError,
  focusFirstInvalid,
  passwordError,
  requiredError,
  useTouched,
} from "@/lib/auth-validation";
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
  const check = useTouched<"email" | "name" | "password">();
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
    check.markSubmitted();
    const errs: [string, unknown][] = [
      ["register-email", emailError(email)],
      ["register-name", requiredError(name, "lndAuthNameRequired")],
      ["register-password", passwordError(password, MIN_PASSWORD)],
    ];
    if (errs.some(([, err]) => err)) {
      focusFirstInvalid(errs);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<RegistrationResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      // No token comes back on purpose, see the file header.
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
        icon="mail"
        footer={
          <p className="f-auth-alt">
            <AuthLink onClick={goToLogin}>{t("authBackToLogin")}</AuthLink>
          </p>
        }
      >
        <CheckInboxNotice email={registeredEmail} />
      </AuthCard>
    );
  }

  const emailErr = check.show("email") ? emailError(email) : null;
  const nameErr = check.show("name") ? requiredError(name, "lndAuthNameRequired") : null;
  const passErr = check.show("password") ? passwordError(password, MIN_PASSWORD) : null;
  const emailOk = !lockedEmail && check.show("email") && !emailErr ? t("lndAuthEmailOk") : null;

  return (
    <AuthCard title={t("registerTitle")} subtitle={t("authRegisterSub")} error={error} legal>
      {lockedEmail ? null : <SocialButtons onSuccess={land} onError={setError} disabled={loading} />}
      {firebaseEnabled && !lockedEmail ? <AuthDivider /> : null}

      <form className="f-auth-form" noValidate onSubmit={(e) => void submit(e)}>
        <AuthField
          id="register-email"
          label={t("email")}
          error={emailErr ? t(emailErr) : null}
          success={emailOk}
          hint={
            lockedEmail ? (
              <span className="f-auth-lock">
                <Glyph name="lock" size="sm" />
                {t("teamJoinEmailLocked")}
              </span>
            ) : null
          }
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            readOnly={Boolean(lockedEmail)}
            aria-readonly={Boolean(lockedEmail)}
            placeholder={t("authEmailPlaceholder")}
            value={email}
            onChange={(e) => {
              if (!lockedEmail) setEmail(e.target.value);
            }}
            onBlur={() => check.touch("email")}
          />
        </AuthField>

        <AuthField id="register-name" label={t("authNameLabel")} error={nameErr ? t(nameErr) : null}>
          <Input
            type="text"
            autoComplete="name"
            required
            placeholder={t("authNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => check.touch("name")}
          />
        </AuthField>

        <PasswordField
          id="register-password"
          label={t("password")}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          placeholder={t("authPasswordPlaceholder")}
          value={password}
          onChange={setPassword}
          onBlur={() => check.touch("password")}
          disabled={loading}
          error={passErr ? t(passErr) : null}
        />

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? t("authWorking") : t("authSignUpCta")}
        </Button>
      </form>

      <p className="f-auth-alt">
        {t("authHaveAccount")} <AuthLink onClick={goToLogin}>{t("authSignInCta")}</AuthLink>
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
