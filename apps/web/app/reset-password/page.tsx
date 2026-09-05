"use client";

/**
 * Choose a new password from an emailed link.
 *
 * The server returns a fresh session token, so the visitor lands signed in
 * rather than back at the login form — they have just proven control of the
 * mailbox, and asking them to type the password they only now chose is
 * friction with no security value. Every other session is revoked server-side.
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { api, setToken } from "@/lib/api";
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t("authPasswordTooShort"));
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
        error={t("authResetNoToken")}
        footer={
          <p className="auth-alt" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="auth-link"
              onClick={() => router.push("/forgot-password")}
            >
              {t("authForgotTitle")}
            </button>
          </p>
        }
      />
    );
  }

  return (
    <AuthCard title={t("authResetTitle")} subtitle={t("authResetSub")} error={error}>
      <form onSubmit={(e) => void submit(e)}>
        <PasswordField
          id="reset-password"
          label={t("password")}
          autoComplete="new-password"
          minLength={8}
          placeholder={t("authPasswordPlaceholder")}
          value={password}
          onChange={setPassword}
          disabled={loading}
        />

        <button className="btn" type="submit" style={{ width: "100%" }} disabled={loading}>
          {loading ? t("authWorking") : t("authResetCta")}
        </button>
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
