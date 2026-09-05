"use client";

/**
 * "We sent you a link" — the screen that ends registration.
 *
 * Registration no longer signs anyone in: an account without a confirmed
 * address has no RodiumAi account behind it, so no wallet, no generation key,
 * nothing to build with. Dropping someone into that builder looks broken.
 * Confirming is the real last step, so the UI says so and gives them the two
 * things they might need — a resend, and a way back to sign in.
 *
 * Resend always reports success, matching the endpoint: answering differently
 * for a known and an unknown address would turn this into a way to test which
 * addresses have accounts.
 */

import { MailCheck } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function CheckInboxNotice({ email }: { email: string }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await api("/auth/verify-email/resend", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      // The endpoint reports success regardless; a network blip is not worth
      // an alarming message on a purely informational screen.
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      <MailCheck
        size={40}
        aria-hidden
        style={{ margin: "0 auto 0.75rem", display: "block", opacity: 0.7 }}
      />
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
        {t("authCheckInboxBody")}
      </p>
      <p style={{ margin: "0 0 1.25rem", fontWeight: 600, wordBreak: "break-all" }}>
        {email}
      </p>
      <p className="muted" style={{ margin: "0 0 1.25rem", fontSize: "0.85rem" }}>
        {t("authCheckInboxHint")}
      </p>

      {sent ? (
        <p className="auth-notice" role="status" style={{ marginBottom: 0 }}>
          {t("authVerifyResendDone")}
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: "100%" }}
          disabled={busy}
          onClick={() => void resend()}
        >
          {busy ? t("authWorking") : t("authVerifyResend")}
        </button>
      )}
    </div>
  );
}
