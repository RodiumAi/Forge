"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useHomeSetting } from "@/components/home/use-home-prefs";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    boxRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => previous?.focus?.();
  }, []);
  return (
    <div
      className="fdh-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className="fdh-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <h2 id={titleId} className="fdh-dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function RenameDialog({
  name,
  onCancel,
  onSave,
}: {
  name: string;
  onCancel: () => void;
  onSave: (next: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  return (
    <Dialog title={t("homeRenameTitle")} onClose={() => !busy && onCancel()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = value.trim();
          if (!next || next === name) return onCancel();
          setBusy(true);
          setError(null);
          void onSave(next).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : t("errorGeneric"));
            setBusy(false);
          });
        }}
      >
        <label className="fdh-dialog-label" htmlFor={inputId}>
          {t("homeRenameLabel")}
        </label>
        <input
          id={inputId}
          className="fdh-dialog-input"
          value={value}
          maxLength={200}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
        />
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fdh-dialog-actions">
          <button type="button" className="fdh-pill" onClick={onCancel} disabled={busy}>
            {t("homeCancel")}
          </button>
          <button type="submit" className="fdh-pill fdh-primary" disabled={busy || !value.trim()}>
            {t("homeSave")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Same guard as the builder: type the project name to delete it. */
export function DeleteDialog({
  name,
  onCancel,
  onDelete,
}: {
  name: string;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const ok = confirm.trim() === name.trim();
  return (
    <Dialog title={t("homeDeleteTitle").replace("{name}", name)} onClose={() => !busy && onCancel()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!ok) return;
          setBusy(true);
          setError(null);
          void onDelete().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : t("errorGeneric"));
            setBusy(false);
          });
        }}
      >
        <p className="fdh-dialog-text">{t("optionsDangerHelp")}</p>
        <label className="fdh-dialog-label" htmlFor={inputId}>
          {t("optionsDangerConfirm").replace("{name}", name)}
        </label>
        <input
          id={inputId}
          className="fdh-dialog-input"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={busy}
          autoComplete="off"
        />
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fdh-dialog-actions">
          <button type="button" className="fdh-pill" onClick={onCancel} disabled={busy}>
            {t("homeCancel")}
          </button>
          <button type="submit" className="fdh-pill fdh-danger" disabled={busy || !ok}>
            {busy ? t("optionsDangerDeleting") : t("optionsDangerDelete")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Dismissible "Nouveau : Forge Design" banner, closed for good once dismissed. */
export function AnnouncementBanner() {
  const { t } = useI18n();
  const [state, setState] = useHomeSetting("announce_forge_design", "open", ["open", "closed"] as const);
  if (state === "closed") return null;
  return (
    <aside className="fdh-announce" aria-label={t("homeAnnounceTitle")}>
      <Icon icon={Sparkles} className="ui-icon-sm fdh-announce-icon" />
      <p>
        <strong>{t("homeAnnounceTitle")}</strong> <span>{t("homeAnnounceBody")}</span>
      </p>
      <button
        type="button"
        className="fdh-icon-btn"
        aria-label={t("homeAnnounceDismiss")}
        onClick={() => setState("closed")}
      >
        <Icon icon={X} className="ui-icon-sm" />
      </button>
    </aside>
  );
}
