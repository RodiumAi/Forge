"use client";

/**
 * "Aperçu du document": the brand guidelines exactly as the PDF export and the
 * published page show them, rendered by the API from the saved document. The
 * page runs no script, so the frame is sandboxed without any permission.
 */

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { previewHtml } from "./api";

export function DesignSystemPreview({
  projectId,
  version,
  beforeLoad,
}: {
  projectId: string;
  /** Changes after each save: the preview reloads with the saved document. */
  version: number;
  /** Saves pending edits so the preview shows them. */
  beforeLoad: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const before = useRef(beforeLoad);
  before.current = beforeLoad;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await before.current();
      setHtml(await previewHtml(projectId, locale));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, locale]);

  useEffect(() => {
    void load();
  }, [load, version]);

  return (
    <div className="dsv">
      <div className="dsv-bar">
        <p className="dsv-hint">{t("dsPreviewHint")}</p>
        <button type="button" className="f-btn f-btn-ghost f-btn-sm" onClick={() => void load()} disabled={loading}>
          <Icon icon={RefreshCw} className={`ui-icon-sm${loading ? " dse-spin" : ""}`} /> {t("dsPreviewRefresh")}
        </button>
      </div>
      {error ? (
        <p className="dsp-error" role="alert">
          {t("dsPreviewFailed")}
        </p>
      ) : null}
      {html !== null ? (
        <iframe className={`dsv-frame${loading ? " is-loading" : ""}`} title={t("dsPreview")} sandbox="" srcDoc={html} />
      ) : !error ? (
        <div className="dsv-frame dsv-skeleton" aria-busy="true" />
      ) : null}
    </div>
  );
}
