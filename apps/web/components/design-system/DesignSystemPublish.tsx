"use client";

/**
 * The "Publier" view of the share panel: what goes online (a public brand
 * page), a preview of it, whether it is already online, the badge choice, then
 * the link to copy or open. Nothing is published until the user confirms.
 */

import { Check, Copy, ExternalLink, Globe, Loader2, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { badgeRemovable } from "@/lib/deck-exports";
import { useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { publish, type PublishState } from "./api";
import { colorEntries, fontFamily, type DesignSystemDoc } from "./tokens";

export function sinceLabel(iso: string, locale: string): string {
  const then = new Date(iso);
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 1) return rtf.format(0, "minute");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return then.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

/** A small picture of the published page: name, palette and type. */
function PagePreview({ doc }: { doc: DesignSystemDoc }) {
  const colors = colorEntries(doc).slice(0, 6);
  const display = fontFamily(doc, "display");
  return (
    <div className="dsp-preview" aria-hidden>
      <div className="dsp-preview-bar">
        <i />
        <i />
        <i />
      </div>
      <div className="dsp-preview-body">
        <strong style={{ fontFamily: display ? `"${display}", sans-serif` : undefined }}>{doc.name}</strong>
        <div className="dsp-preview-swatches">
          {colors.map((c) => (
            <span key={c.name} style={{ background: c.value }} />
          ))}
        </div>
        <div className="dsp-preview-type">
          <span style={{ fontFamily: display ? `"${display}", sans-serif` : undefined }}>Aa</span>
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

export function PublishView({
  projectId,
  doc,
  state,
  onPublished,
  beforePublish,
  onCopy,
  copied,
}: {
  projectId: string;
  doc: DesignSystemDoc;
  state: PublishState | null;
  onPublished: (next: PublishState) => void;
  /** Saves pending edits before publishing. */
  beforePublish: () => Promise<void>;
  onCopy: () => void;
  copied: boolean;
}) {
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const removable = badgeRemovable(status);
  const [badge, setBadge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const live = Boolean(state?.published_at);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await beforePublish();
      const next = await publish(projectId, { badge: removable ? badge : true });
      onPublished({ ...next, published_at: next.published_at ?? new Date().toISOString() });
      setJustPublished(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message ? `${t("dsPublishFailed")} ${message}` : t("dsPublishFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dsp">
      <p className="dsh-intro">{t("dsPublishIntro")}</p>
      <PagePreview doc={doc} />
      <div className={`dsp-status${live ? " is-live" : ""}`}>
        <span className="dsp-status-dot" aria-hidden />
        <span>
          {live && state?.published_at
            ? t("dsPublishOnline").replace("{when}", sinceLabel(state.published_at, locale))
            : t("dsPublishNotYet")}
        </span>
      </div>
      <p className="dsp-access">
        <Icon icon={Globe} className="ui-icon-sm" /> {t("dsPublishAccess")}
      </p>
      <label className="dsp-check">
        <input type="checkbox" checked={removable ? badge : true} disabled={!removable} onChange={(e) => setBadge(e.target.checked)} />
        <span>{t("dsPublishBadge")}</span>
        {!removable ? <Icon icon={Lock} className="ui-icon-sm" /> : null}
      </label>
      {!removable ? <p className="dsp-hint">{t("dsPublishBadgeLocked")}</p> : null}
      <button type="button" className="f-btn f-btn-primary dsp-run" onClick={() => void run()} disabled={busy}>
        {busy ? (
          <Loader2 className="ui-icon-sm dse-spin" aria-hidden />
        ) : live ? (
          <Icon icon={RefreshCw} className="ui-icon-sm" />
        ) : (
          <Icon icon={Globe} className="ui-icon-sm" />
        )}{" "}
        {busy ? t("dsPublishing") : live ? t("dsPublishUpdate") : t("dsPublishRun")}
      </button>
      {error ? (
        <p className="dsp-error" role="alert">
          {error}
        </p>
      ) : null}
      {live && state?.public_url ? (
        <div className={`dsp-link${justPublished ? " is-fresh" : ""}`} role="status">
          {justPublished ? (
            <p className="dsp-done">
              <Icon icon={Check} className="ui-icon-sm" /> {t("dsPublished")}
            </p>
          ) : null}
          <div className="dsp-link-row">
            <input readOnly value={state.public_url} aria-label={t("dsPublishLink")} onFocus={(e) => e.target.select()} />
            <button type="button" className="f-icon-btn f-icon-btn-sm" onClick={onCopy} aria-label={t("dsPublishCopy")} title={t("dsPublishCopy")}>
              <Icon icon={copied ? Check : Copy} />
            </button>
            <a
              className="f-icon-btn f-icon-btn-sm"
              href={state.public_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("dsOpenSite")}
              title={t("dsOpenSite")}
            >
              <Icon icon={ExternalLink} />
            </a>
          </div>
          <p className="dsp-hint">{t("dsPublishLater")}</p>
        </div>
      ) : null}
    </div>
  );
}
