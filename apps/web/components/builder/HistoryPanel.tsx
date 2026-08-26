"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Snapshot = {
  id: string;
  label: string;
  created_at: string;
  files_changed: number;
};

type HistoryResponse = {
  available: boolean;
  snapshots: Snapshot[];
};

function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/**
 * Project checkpoint history.
 *
 * Every batch of agent writes and every manual edit snapshots the workspace, so
 * a bad turn is no longer final. Restoring is forward-only: it appends a new
 * checkpoint rather than rewriting history, so an undo is itself undoable.
 */
export function HistoryPanel({
  projectId,
  open,
  onClose,
  onRestored,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { t, locale } = useI18n();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<HistoryResponse>(`/projects/${projectId}/history`);
      setAvailable(res.available);
      setSnapshots(res.snapshots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function restore(snapshot: Snapshot) {
    if (restoringId) return;
    if (!window.confirm(t("historyRestoreConfirm").replace("{label}", snapshot.label))) {
      return;
    }
    setRestoringId(snapshot.id);
    setError(null);
    try {
      await api(`/projects/${projectId}/history/${snapshot.id}/restore`, {
        method: "POST",
      });
      await load();
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setRestoringId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="history-panel" role="dialog" aria-modal="true" aria-label={t("historyTitle")}>
      <header className="history-panel-head">
        <span className="history-panel-title">
          <Icon icon={History} className="ui-icon-sm" />
          {t("historyTitle")}
        </span>
        <button
          type="button"
          className="history-panel-close"
          onClick={onClose}
          aria-label={t("close")}
        >
          <Icon icon={X} className="ui-icon-sm" />
        </button>
      </header>

      {!available ? (
        <p className="history-panel-empty">{t("historyUnavailable")}</p>
      ) : loading && !snapshots.length ? (
        <ul className="history-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} />
          ))}
        </ul>
      ) : !snapshots.length ? (
        <p className="history-panel-empty">{t("historyEmpty")}</p>
      ) : (
        <ol className="history-list">
          {snapshots.map((snap, idx) => (
            <li key={snap.id} className="history-item">
              <div className="history-item-main">
                <span className="history-item-label">{snap.label}</span>
                <span className="history-item-meta">
                  {relativeTime(snap.created_at, locale)}
                  {idx === 0 ? ` · ${t("historyCurrent")}` : ""}
                </span>
              </div>
              {idx > 0 ? (
                <button
                  type="button"
                  className="history-restore"
                  onClick={() => void restore(snap)}
                  disabled={Boolean(restoringId)}
                >
                  <Icon icon={RotateCcw} className="ui-icon-sm" />
                  {restoringId === snap.id ? t("historyRestoring") : t("historyRestore")}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {error ? <p className="history-panel-error">{error}</p> : null}
    </div>
  );
}
