"use client";

/**
 * Choose a new password from an emailed link.
 *
 * The server returns a fresh session token, so the visitor lands signed in
 * rather than back at the login form, they have just proven control of the
 * mailbox, and asking them to type the password they only now chose is
 * friction with no security value. Every other session is revoked server-side.
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { api, setToken } from "@/lib/api";
import { MIN_PASSWORD, focusFirstInvalid, passwordError, useTouched } from "@/lib/auth-validation";
import { useI18n } from "@/lib/i18n/I18nProvider";

type TokenResponse = { access_token: string };

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();

  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const check = useTouched<"password">();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    check.markSubmitted();
    const err = passwordError(password, MIN_PASSWORD);
    if (err) {
      focusFirstInvalid([["reset-password", err]]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<TokenResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setToken(data.access_token);
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard
        title={t("authResetTitle")}
        icon="alert"
        tone="danger"
        error={t("authResetNoToken")}
        footer={
          <p className="f-auth-alt">
            <AuthLink onClick={() => router.push("/forgot-password")}>{t("authForgotTitle")}</AuthLink>
          </p>
        }
      />
    );
  }

  const passErr = check.show("password") ? passwordError(password, MIN_PASSWORD) : null;

  return (
    <AuthCard title={t("authResetTitle")} subtitle={t("authResetSub")} icon="lock" error={error}>
      <form className="f-auth-form" noValidate onSubmit={(e) => void submit(e)}>
        <PasswordField
          id="reset-password"
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
          {loading ? t("authWorking") : t("authResetCta")}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
