"use client";

/**
 * "Confirm your email address", shown above the builder until the account's
 * address is verified.
 *
 * Informative, never blocking: sign-up deliberately lets people in first, and
 * nothing in the product is gated on this flag. What it does gate is account
 * *linking* — an unverified address cannot be adopted by a Google, GitHub or
 * RodiumAi identity — so the nudge is worth showing, and worth being able to
 * dismiss for the session.
 */

import { useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Me = { email: string; email_verified?: boolean; rodium_linked?: boolean };

export function VerifyEmailBanner() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<Me>("/auth/me");
        if (!cancelled) setMe(data);
      } catch {
        // The banner is not worth surfacing an error for.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me || me.email_verified || dismissed) return null;

  async function resend() {
    if (!me) return;
    setBusy(true);
    try {
      await api("/auth/verify-email/resend", {
        method: "POST",
        body: JSON.stringify({ email: me.email }),
      });
      setResent(true);
    } catch {
      // The endpoint always reports success anyway; a network blip here is
      // not worth an alarming message on a passive banner.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-verify-banner" role="status">
      <strong>{t("authVerifyBannerTitle")}</strong>
      <span className="muted">
        {t("authVerifyBannerBody").replace("{email}", me.email)}
      </span>
      {resent ? (
        <span className="muted">{t("authVerifyResendDone")}</span>
      ) : (
        <button type="button" className="auth-link" disabled={busy} onClick={() => void resend()}>
          {busy ? t("authWorking") : t("authVerifyResend")}
        </button>
      )}
      <button
        type="button"
        className="auth-link"
        style={{ marginLeft: "auto" }}
        onClick={() => setDismissed(true)}
        aria-label={t("close")}
      >
        ×
      </button>
    </div>
  );
}
