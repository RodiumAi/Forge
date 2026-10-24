"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

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
        <p className="f-bd-hist-empty">{t("historyUnavailable")}</p>
      ) : loading && !snapshots.length ? (
        <ul className="f-bd-hist-skel" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="f-skel" />
          ))}
        </ul>
      ) : !snapshots.length ? (
        <p className="f-bd-hist-empty">{t("historyEmpty")}</p>
      ) : (
        <ol className="f-bd-hist">
          {snapshots.map((snap, idx) => {
            const who = snap.actor?.name || snap.actor?.email || "";
            return (
              <li key={snap.id} className="f-bd-hist-row">
                <Avatar name={who || "Forge"} src={snap.actor?.avatar_url} size="xs" tone={idx === 0 ? "self" : "other"} />
                <div className="l">
                  <b>{snap.label}</b>
                  <small>
                    {relativeTime(snap.created_at, locale)}
                    {who ? ` · ${who}` : ""}
                    {snap.files_changed ? ` · ${t("bdDoneFiles").replace("{n}", String(snap.files_changed))}` : ""}
                  </small>
                </div>
                {idx === 0 ? (
                  <Tag tone="ok">{t("historyCurrent")}</Tag>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon="undo"
                    onClick={() => void restore(snap)}
                    disabled={Boolean(restoringId)}
                  >
                    {restoringId === snap.id ? t("historyRestoring") : t("historyRestore")}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {limited ? (
        <div className="f-bd-hist-upgrade">
          <p>{t("historyLimited").replace("{n}", String(snapshots.length || 5))}</p>
          {onUpgrade ? (
            <Button size="sm" variant="ghost" icon="zap" onClick={onUpgrade}>
              {t("historyUpgrade")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="f-bd-hist-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="f-bd-hist-panel">{body}</div>;
  }

  return (
    <Sheet open={open} onClose={onClose} side="right" title={t("historyTitle")} closeLabel={t("close")} className="f-bd-hist-sheet">
      {body}
    </Sheet>
  );
}
