"use client";

/**
 * "We sent you a link": the screen that ends registration.
 *
 * Registration no longer signs anyone in: an account without a confirmed
 * address has no RodiumAi account behind it, so no wallet, no generation key,
 * nothing to build with. Dropping someone into that builder looks broken.
 * Confirming is the real last step, so the UI says so and gives them the two
 * things they might need: a resend, and a way back to sign in.
 *
 * Resend always reports success, matching the endpoint: answering differently
 * for a known and an unknown address would turn this into a way to test which
 * addresses have accounts.
 */

import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
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
    <div className="f-auth-inbox">
      <p>{t("authCheckInboxBody")}</p>
      <div className="f-auth-email-chip">
        <Glyph name="mail" size="sm" />
        <b>{email}</b>
      </div>
      <p className="f-auth-inbox-hint">{t("authCheckInboxHint")}</p>

      {sent ? (
        <AuthAlert tone="ok">{t("authVerifyResendDone")}</AuthAlert>
      ) : (
        <Button variant="ghost" block icon="send" loading={busy} onClick={() => void resend()}>
          {busy ? t("authWorking") : t("authVerifyResend")}
        </Button>
      )}
    </div>
  );
}
