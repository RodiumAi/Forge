"use client";

/**
 * Request a password-reset link.
 *
 * The confirmation is deliberately identical whether or not the address has
 * an account: answering differently would turn this page into a membership
 * oracle for every Forge user. The server applies the same rule.
 */

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard, AuthField } from "@/components/auth/AuthCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

function ForgotPasswordInner() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("authForgotTitle")}
      subtitle={sent ? undefined : t("authForgotSub")}
      error={error}
      notice={sent ? t("authForgotDone") : null}
      footer={
        <p className="auth-alt" style={{ marginTop: 0 }}>
          <button type="button" className="auth-link" onClick={() => router.push("/login")}>
            {t("authBackToLogin")}
          </button>
        </p>
      }
    >
      {sent ? null : (
        <form onSubmit={(e) => void submit(e)}>
          <AuthField id="forgot-email" label={t("email")}>
            <input
              id="forgot-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              placeholder={t("authEmailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </AuthField>

          <button className="btn" type="submit" style={{ width: "100%" }} disabled={loading}>
            {loading ? t("authWorking") : t("authForgotCta")}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
