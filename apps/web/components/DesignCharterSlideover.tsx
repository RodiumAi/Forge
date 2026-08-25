"use client";

import { FormEvent, useEffect, useState } from "react";
import { Palette, X } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

type CharterOut = {
  path: string;
  markdown: string | null;
  brief: string | null;
  exists: boolean;
};

export function DesignCharterSlideover({ projectId, open, onClose }: Props) {
  const { t } = useI18n();
  const [brief, setBrief] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaved(false);
    void api<CharterOut>(`/projects/${projectId}/design-charter`)
      .then((data) => {
        setBrief(data.brief || "");
        setMarkdown(data.markdown || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("errorGeneric")));
  }, [open, projectId, t]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!brief.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ markdown: string; brief: string }>(
        `/projects/${projectId}/design-charter`,
        {
          method: "POST",
          body: JSON.stringify({
            brief: brief.trim(),
            logo_url: logoUrl.trim() || null,
          }),
        },
      );
      setMarkdown(res.markdown);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMarkdown() {
    if (!markdown.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/design-charter`, {
        method: "PUT",
        body: JSON.stringify({ markdown: markdown.trim(), brief: brief.trim() || null }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
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
        className="design-slideover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-slideover-title"
      >
        <header className="design-slideover-head">
          <div className="design-slideover-title-row">
            <span className="design-slideover-icon" aria-hidden>
              <Icon icon={Palette} className="ui-icon-sm" />
            </span>
            <div>
              <h2 id="design-slideover-title">{t("designTitle")}</h2>
              <p>{t("designSub")}</p>
            </div>
          </div>
          <button
            type="button"
            className="builder-toolbar-btn builder-toolbar-btn-icon"
            onClick={onClose}
            aria-label={t("close")}
          >
            <Icon icon={X} className="ui-icon-md" />
          </button>
        </header>

        <div className="design-slideover-body">
          {error && (
            <div className="builder-error" role="alert">
              {error}
            </div>
          )}
          {saved && <p className="design-saved">{t("designSaved")}</p>}

          <form className="design-form" onSubmit={onGenerate}>
            <label className="design-label">
              {t("designBrief")}
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={5}
                placeholder={t("designBriefPlaceholder")}
                disabled={busy}
              />
            </label>
            <label className="design-label">
              {t("designLogoUrl")}
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                disabled={busy}
              />
            </label>
            <button type="submit" className="btn" disabled={busy || brief.trim().length < 8}>
              {busy ? t("designGenerating") : t("designGenerate")}
            </button>
          </form>

          {markdown ? (
            <div className="design-preview">
              <label className="design-label">
                DESIGN.md
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  rows={14}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void onSaveMarkdown()}
                disabled={busy}
              >
                {t("designSaveMd")}
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/** @deprecated Prefer DesignCharterSlideover */
export const DesignCharterModal = DesignCharterSlideover;
