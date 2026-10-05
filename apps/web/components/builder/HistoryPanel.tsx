"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Actor = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Snapshot = {
  id: string;
  label: string;
  created_at: string;
  files_changed: number;
  actor?: Actor | null;
};

type HistoryResponse = {
  available: boolean;
  limited?: boolean;
  total?: number;
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
  embedded = false,
  onUpgrade,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
  embedded?: boolean;
  onUpgrade?: () => void;
}) {
  const { t, locale } = useI18n();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [limited, setLimited] = useState(false);
  const [total, setTotal] = useState(0);
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
      setLimited(Boolean(res.limited));
      setTotal(res.total || (res.snapshots || []).length);
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

  const body = (
    <>
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
                {snap.actor?.name || snap.actor?.email ? (
                  <span className="history-actor">
                    <span className="history-actor-avatar" aria-hidden>
                      {snap.actor.avatar_url ? (
                        <img src={snap.actor.avatar_url} alt="" />
                      ) : (
                        initials(snap.actor.name || snap.actor.email || "")
                      )}
                    </span>
                    {snap.actor.name || snap.actor.email}
                  </span>
                ) : null}
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

      {limited ? (
        <div className="history-upgrade">
          <p>{t("historyLimited").replace("{n}", String(snapshots.length || 5))}</p>
          {onUpgrade ? (
            <button type="button" className="btn" onClick={onUpgrade}>
              {t("historyUpgrade")}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="history-panel-error">{error}</p> : null}
    </>
  );

  if (embedded) {
    return <div className="history-embedded">{body}</div>;
  }

  return (
    <div className="design-slideover-root">
      <button
        type="button"
        className="design-slideover-backdrop"
        aria-label={t("close")}
        onClick={onClose}
      />
      <aside
        className="design-slideover history-slideover"
        role="dialog"
        aria-modal="true"
        aria-label={t("historyTitle")}
      >
        <header className="history-panel-head">
          <span className="history-panel-title">
            <Icon icon={History} className="ui-icon-sm" />
            {t("historyTitle")}
          </span>
          <button type="button" className="history-panel-close" onClick={onClose} aria-label={t("close")}>
            <Icon icon={X} className="ui-icon-sm" />
          </button>
        </header>
        {body}
      </aside>
    </div>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}
