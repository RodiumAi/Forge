"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** A pending Team invite for this account: a notice on the overview and its confirm dialog. */
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
      <div className="f-card f-row-line f-ov-notice" role="status" style={{ padding: "14px 18px" }}>
        <div className="l" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Glyph name="users" style={{ color: "var(--f-accent-text)" }} />
          <b style={{ fontWeight: 500 }}>{t("dashboardTeamInvite")}</b>
        </div>
        <div className="r">
          <Button size="sm" onClick={() => setOpen(true)}>
            {t("dashboardTeamInviteAccept")}
          </Button>
        </div>
      </div>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t("dashboardTeamInviteConfirm")}
        description={t("dashboardTeamInviteDetail")}
        closeLabel={t("uiClose")}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t("teamCancel")}
            </Button>
            <Button loading={busy} onClick={() => void accept()}>
              {busy ? t("dashboardTeamInviteWorking") : t("dashboardTeamInviteYes")}
            </Button>
          </>
        }
      >
        {error ? (
          <p className="f-error" role="alert">
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
