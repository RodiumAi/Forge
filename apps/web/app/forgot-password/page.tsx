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

import { AuthAlert, AuthCard, AuthField, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { emailError, focusFirstInvalid, useTouched } from "@/lib/auth-validation";
import { useI18n } from "@/lib/i18n/I18nProvider";

function ForgotPasswordInner() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const check = useTouched<"email">();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    check.markSubmitted();
    const err = emailError(email);
    if (err) {
      focusFirstInvalid([["forgot-email", err]]);
      return;
    }
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

  const emailErr = check.show("email") ? emailError(email) : null;

  if (sent) {
    return (
      <AuthCard
        title={t("authForgotTitle")}
        icon="mail"
        tone="ok"
        footer={
          <p className="f-auth-alt">
            <AuthLink onClick={() => router.push("/login")}>{t("authBackToLogin")}</AuthLink>
          </p>
        }
      >
        <div className="f-auth-inbox">
          <AuthAlert tone="ok">{t("authForgotDone")}</AuthAlert>
          <div className="f-auth-email-chip">
            <Glyph name="mail" size="sm" />
            <span>{t("lndAuthSentTo")}</span>
            <b>{email.trim()}</b>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("authForgotTitle")}
      subtitle={t("authForgotSub")}
      icon="key"
      error={error}
      footer={
        <p className="f-auth-alt">
          <AuthLink onClick={() => router.push("/login")}>{t("authBackToLogin")}</AuthLink>
        </p>
      }
    >
      <form className="f-auth-form" noValidate onSubmit={(e) => void submit(e)}>
        <AuthField id="forgot-email" label={t("email")} error={emailErr ? t(emailErr) : null}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder={t("authEmailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => check.touch("email")}
          />
        </AuthField>

        <Button type="submit" size="lg" block loading={loading} iconEnd={loading ? undefined : "send"}>
          {loading ? t("authWorking") : t("authForgotCta")}
        </Button>
      </form>
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
