"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function TeamInviteNotice() {
  const { t, locale } = useI18n();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ pending?: boolean }>("/auth/team/inbox", {}, locale)
      .then((res) => setPending(Boolean(res.pending)))
      .catch(() => setPending(false));
  }, [locale]);

  if (!pending) return null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/team/inbox/accept", { method: "POST" }, locale);
      window.location.assign("/dashboard");
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : t("teamJoinInvalid"));
    }
  }

  return (
    <>
      <div className="team-invite-note" role="status">
        <p>{t("dashboardTeamInvite")}</p>
        <div className="team-invite-note-actions">
          <button type="button" className="team-invite-note-go" onClick={() => setOpen(true)}>
            {t("dashboardTeamInviteAccept")}
          </button>
        </div>
      </div>
      {open ? (
        <div className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-invite-confirm">
          <button
            type="button"
            className="team-dialog-backdrop"
            aria-label={t("teamCancel")}
            disabled={busy}
            onClick={() => {
              if (!busy) setOpen(false);
            }}
          />
          <div className="team-dialog-card">
            <h2 id="team-invite-confirm">{t("dashboardTeamInviteConfirm")}</h2>
            <p className="team-dialog-terms">{t("dashboardTeamInviteDetail")}</p>
            {error ? <p className="team-dialog-error">{error}</p> : null}
            <div className="team-dialog-actions">
              <button type="button" className="team-dialog-ghost" disabled={busy} onClick={() => setOpen(false)}>
                {t("teamCancel")}
              </button>
              <button type="button" className="team-dialog-primary" disabled={busy} onClick={() => void accept()}>
                {busy ? t("dashboardTeamInviteWorking") : t("dashboardTeamInviteYes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
