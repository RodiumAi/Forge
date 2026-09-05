"use client";

/**
 * The one button under a failed generation.
 *
 * An error the user cannot act on is just noise, and that is what the builder
 * used to show: a spent RODI wallet surfaced as "Payment Required" with a
 * Retry button that could only fail again. Which button belongs to which
 * failure is decided in `lib/chat-errors.ts`; this renders it, and owns the
 * one-off wiring each destination needs.
 *
 * Deliberately at most one action plus, where it helps, a quiet settings link:
 * a row of choices at the moment something broke is a worse experience than a
 * single obvious next step.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ChatErrorAction } from "@/lib/chat-errors";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { startRodiumOAuth } from "@/lib/rodium-oauth";
import { getSessionSnapshot, subscribeSession } from "@/lib/session-cache";

type Props = {
  action: ChatErrorAction;
  busy: boolean;
  /** Re-run whatever failed. Absent when there is nothing to re-run. */
  onRetry?: () => void;
  /** Pick a stopped plan back up. Absent when no run is resumable. */
  onResume?: () => void;
  /** Ambiguous visual edit → send a chat prompt that applies the change. */
  onEditInChat?: (prompt: string) => void;
};

/** Absolute URL — for external Rodium recharge links (return_url query). */
function returnHereAbsolute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

/** Relative path — for Forge OAuth callback (open-redirect safe). */
function returnHerePath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.pathname}${window.location.search}`;
}

export function ChatErrorActions({ action, busy, onRetry, onResume, onEditInChat }: Props) {
  const { t } = useI18n();
  const [rodiumSub, setRodiumSub] = useState<string | null>(
    () => getSessionSnapshot()?.profile?.rodium_sub ?? null,
  );
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(
    () => subscribeSession((snap) => setRodiumSub(snap?.profile?.rodium_sub ?? null)),
    [],
  );

  async function reconnectRodium() {
    setReconnecting(true);
    const result = await startRodiumOAuth({
      returnTo: returnHerePath(),
      unavailableHref: "/settings?tab=generation",
    });
    if (!result.ok) setReconnecting(false);
  }

  if (action.kind === "none") return null;

  if (action.kind === "recharge") {
    return (
      <div className="builder-msg-error-actions">
        <a
          className="builder-msg-error-retry"
          href={rodiumRechargeUrl(rodiumSub, returnHereAbsolute())}
          target="_blank"
          rel="noreferrer"
        >
          {t("chatActionRecharge")}
        </a>
        {onRetry ? (
          <button
            type="button"
            className="builder-msg-error-link"
            disabled={busy}
            onClick={onRetry}
          >
            {t("retryAction")}
          </button>
        ) : null}
      </div>
    );
  }

  if (action.kind === "reconnect-rodium") {
    return (
      <div className="builder-msg-error-actions">
        <button
          type="button"
          className="builder-msg-error-retry"
          disabled={reconnecting}
          onClick={() => void reconnectRodium()}
        >
          {reconnecting ? t("authWorking") : t("chatActionReconnect")}
        </button>
        <Link href="/settings?tab=generation" className="builder-msg-error-link">
          {t("chatActionSettings")}
        </Link>
      </div>
    );
  }

  if (action.kind === "open-settings") {
    return (
      <div className="builder-msg-error-actions">
        <Link href="/settings?tab=generation" className="builder-msg-error-retry">
          {t("chatActionSettings")}
        </Link>
        {onRetry ? (
          <button
            type="button"
            className="builder-msg-error-link"
            disabled={busy}
            onClick={onRetry}
          >
            {t("retryAction")}
          </button>
        ) : null}
      </div>
    );
  }

  if (action.kind === "edit-in-chat") {
    if (!onEditInChat) return null;
    return (
      <div className="builder-msg-error-actions">
        <button
          type="button"
          className="builder-msg-error-action"
          disabled={busy}
          onClick={() => onEditInChat(action.prompt)}
        >
          {t("visualEditTakeAction")}
        </button>
      </div>
    );
  }

  if (action.kind === "resume-plan") {
    // The plan's own state decides: resume when there is one, otherwise this is
    // an ordinary retry. Both land on the same button position on purpose.
    const handler = onResume ?? onRetry;
    if (!handler) return null;
    return (
      <div className="builder-msg-error-actions">
        <button
          type="button"
          className="builder-msg-error-retry"
          disabled={busy}
          onClick={handler}
        >
          {onResume ? t("chatActionResume") : t("retryAction")}
        </button>
      </div>
    );
  }

  if (!onRetry) return null;
  return (
    <div className="builder-msg-error-actions">
      <button
        type="button"
        className="builder-msg-error-retry"
        disabled={busy}
        onClick={onRetry}
      >
        {t("retryAction")}
      </button>
    </div>
  );
}
