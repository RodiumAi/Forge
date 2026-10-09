"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Inbox, Loader2, Mail, MailOpen, RefreshCw, Trash2 } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type FormSubmission = {
  id: string;
  form: string;
  data: Record<string, string>;
  page: string;
  read: boolean;
  created_at: string;
};

type Inbox = { items: FormSubmission[]; unread: number; total: number };

type Props = {
  projectId: string;
  canEdit?: boolean;
  onError: (msg: string) => void;
};

function formatWhen(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/** Messages visitors sent through `@forge/forms` on the published site. */
export function FormsInboxSection({ projectId, canEdit = true, onError }: Props) {
  const { t, locale } = useI18n();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The parent passes a fresh callback on every render: keep the latest one
  // without re-fetching the inbox each time.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInbox(await api<Inbox>(`/projects/${projectId}/forms?limit=100`));
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRead(item: FormSubmission) {
    setBusyId(item.id);
    try {
      const next = await api<FormSubmission>(`/projects/${projectId}/forms/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: !item.read }),
      });
      setInbox((prev) =>
        prev
          ? {
              ...prev,
              unread: prev.unread + (next.read ? -1 : 1),
              items: prev.items.map((row) => (row.id === item.id ? next : row)),
            }
          : prev,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: FormSubmission) {
    if (!window.confirm(t("formsDeleteConfirm"))) return;
    setBusyId(item.id);
    try {
      await api(`/projects/${projectId}/forms/${item.id}`, { method: "DELETE" });
      setInbox((prev) =>
        prev
          ? {
              total: prev.total - 1,
              unread: prev.unread - (item.read ? 0 : 1),
              items: prev.items.filter((row) => row.id !== item.id),
            }
          : prev,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(`${apiBase()}/projects/${projectId}/forms.csv`, { headers });
      if (!res.ok) throw new Error(res.statusText);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "forms.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  return (
    <div className="options-card options-stack">
      <p className="options-help">{t("formsHelp")}</p>
      <div className="options-actions">
        <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
          <Icon icon={loading ? Loader2 : RefreshCw} className={`ui-icon-sm ${loading ? "agent-spin" : ""}`} />
          {t("formsRefresh")}
        </button>
        {inbox && inbox.total > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => void exportCsv()}>
            <Icon icon={Download} className="ui-icon-sm" />
            {t("formsExport")}
          </button>
        )}
      </div>

      {inbox && (
        <div className="options-stat-row">
          <span>{t("formsTotal")}</span>
          <strong>
            {inbox.total}
            {inbox.unread > 0 ? ` · ${t("formsUnread").replace("{n}", String(inbox.unread))}` : ""}
          </strong>
        </div>
      )}

      {!loading && inbox && inbox.items.length === 0 && (
        <div className="forms-inbox-empty">
          <Icon icon={Inbox} className="ui-icon-md" />
          <p>{t("formsEmpty")}</p>
        </div>
      )}

      <ul className="forms-inbox-list">
        {inbox?.items.map((item) => (
          <li key={item.id} className={`forms-inbox-item ${item.read ? "" : "is-unread"}`}>
            <header className="forms-inbox-item-head">
              <span className="forms-inbox-form">{item.form}</span>
              <time dateTime={item.created_at}>{formatWhen(item.created_at, locale)}</time>
              {item.page && <span className="forms-inbox-page">{item.page}</span>}
            </header>
            <dl className="forms-inbox-fields">
              {Object.entries(item.data).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="forms-inbox-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busyId === item.id}
                onClick={() => void toggleRead(item)}
              >
                <Icon icon={item.read ? Mail : MailOpen} className="ui-icon-sm" />
                {item.read ? t("formsMarkUnread") : t("formsMarkRead")}
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === item.id}
                  onClick={() => void remove(item)}
                >
                  <Icon icon={Trash2} className="ui-icon-sm" />
                  {t("formsDelete")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
