"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ElementSelection } from "./types";

type CommentRow = {
  id: string;
  selector: string;
  anchor_label: string;
  body: string;
  created_at: string;
};

type Props = {
  projectId: string;
  draftAnchor: ElementSelection | null;
  onClearDraft: () => void;
  onClose: () => void;
};

export function CommentsPanel({ projectId, draftAnchor, onClearDraft, onClose }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const rows = await api<CommentRow[]>(`/projects/${projectId}/comments`);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: text,
          selector: draftAnchor?.selector || "",
          anchor_label: draftAnchor
            ? `${draftAnchor.tag}${draftAnchor.selector ? ` ${draftAnchor.selector}` : ""}`
            : "",
        }),
      });
      setBody("");
      onClearDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/projects/${projectId}/comments/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  const filtered = query.trim()
    ? items.filter(
        (c) =>
          c.body.toLowerCase().includes(query.toLowerCase()) ||
          c.anchor_label.toLowerCase().includes(query.toLowerCase()) ||
          c.selector.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  return (
    <aside className="preview-side-panel" aria-label={t("commentsTitle")}>
      <header className="preview-side-panel-head">
        <h3>{t("commentsTitle")}</h3>
        <button type="button" className="preview-side-panel-close" onClick={onClose} title={t("close")}>
          <Icon icon={X} className="ui-icon-sm" />
        </button>
      </header>
      <input
        className="preview-side-panel-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("commentsSearch")}
      />
      {error && <p className="builder-pane-error">{error}</p>}
      <form className="comments-compose" onSubmit={onSubmit}>
        {draftAnchor ? (
          <p className="comments-anchor">
            {t("commentsOn")} <code>{draftAnchor.selector || draftAnchor.tag}</code>
          </p>
        ) : (
          <p className="comments-anchor muted">{t("commentsPickHint")}</p>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("commentsPlaceholder")}
          rows={3}
        />
        <button type="submit" className="btn" disabled={busy || !body.trim()}>
          {t("commentsAdd")}
        </button>
      </form>
      <ul className="comments-list">
        {filtered.length === 0 ? (
          <li className="comments-empty">{t("commentsEmpty")}</li>
        ) : (
          filtered.map((c) => (
            <li key={c.id} className="comments-item">
              <div className="comments-item-meta">
                {c.anchor_label || c.selector || t("commentsGeneral")}
                <button
                  type="button"
                  className="comments-item-delete"
                  title={t("delete")}
                  onClick={() => void remove(c.id)}
                >
                  <Icon icon={Trash2} className="ui-icon-sm" />
                </button>
              </div>
              <p>{c.body}</p>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
