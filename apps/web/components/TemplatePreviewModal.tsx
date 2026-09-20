"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { apiBase } from "@/lib/api";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getSessionSnapshot } from "@/lib/session-cache";
import type { GalleryTemplate } from "@/components/TemplateGallery";

type Props = {
  template: GalleryTemplate;
  busy?: boolean;
  /** Gate error from parent (empty RODI, missing key, etc.). */
  alert?: string | null;
  onClose: () => void;
  onUse: () => void;
};

const PREVIEW_UNLOCK_CSS = `<style data-forge-modal-preview>
html, body {
  height: auto !important;
  min-height: 100% !important;
  max-height: none !important;
  overflow-x: hidden !important;
  overflow-y: visible !important;
}
body {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
</style>`;

/** Kit previews are 480×300 miniatures — scale them to fill our browser chrome. */
const PREVIEW_WEB_SHOWCASE_CSS = `<style data-forge-modal-preview-web>
html {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  background: #0e0e0e !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
body {
  width: 480px !important;
  height: 300px !important;
  min-height: 300px !important;
  max-width: 480px !important;
  margin: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  transform: scale(1.85);
  transform-origin: center center;
  flex: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
</style>`;

/**
 * Kit phones are 172×288 miniatures with absolute px fonts.
 * Stretching .phone to 100% leaves text tiny — keep kit size and scale to cover the iframe.
 */
const PREVIEW_MOBILE_ZOOM_CSS = `<style data-forge-modal-preview-mobile>
html {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  container-type: size;
}
body {
  width: auto !important;
  max-width: none !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  box-sizing: border-box !important;
  background: #000 !important;
  overflow: visible !important;
  flex: none !important;
}
.side { display: none !important; }
.phone {
  width: 172px !important;
  height: 288px !important;
  max-height: none !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  flex: none !important;
  overflow: hidden !important;
  /* ~92% of contain so the UI breathes inside the bezel */
  transform: scale(calc(min(100cqw / 172px, 100cqh / 288px) * 0.92));
  transform-origin: center center;
}
.notch { display: none !important; }
</style>`;

function preparePreviewHtml(
  raw: string,
  templateId: string,
  opts: { mobile?: boolean } = {},
): string {
  let text = raw;
  const mediaBase = `${apiBase()}/templates/${templateId}/media/`;
  text = text
    .replace(/(src=["'])public\//gi, `$1${mediaBase}`)
    .replace(/(url\(["']?)public\//gi, `$1${mediaBase}`);
  if (!/<base\s/i.test(text)) {
    text = text.replace(/<head([^>]*)>/i, `<head$1><base href="${mediaBase}">`);
  }
  const inject = opts.mobile
    ? `${PREVIEW_UNLOCK_CSS}${PREVIEW_MOBILE_ZOOM_CSS}`
    : `${PREVIEW_UNLOCK_CSS}${PREVIEW_WEB_SHOWCASE_CSS}`;
  if (/<head[^>]*>/i.test(text)) {
    text = text.replace(/<head([^>]*)>/i, `<head$1>${inject}`);
  } else {
    text = inject + text;
  }
  return text;
}

function TemplatePreviewFrame({
  templateId,
  src,
  title,
  mobile = false,
}: {
  templateId: string;
  src: string;
  title: string;
  mobile?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(false);

    void (async () => {
      try {
        const url = src.startsWith("http") ? src : `${apiBase()}${src}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (!text.trim()) throw new Error("empty");
        if (cancelled) return;
        setHtml(preparePreviewHtml(text, templateId, { mobile }));
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, templateId, mobile]);

  if (error) {
    return (
      <div className={`tpl-preview-modal-media${mobile ? " is-mobile" : " is-web"}`}>
        <p className="tpl-preview-modal-frame-error">Preview unavailable</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className={`tpl-preview-modal-media${mobile ? " is-mobile" : " is-web"}`}>
        <div
          className={`tpl-preview-modal-frame-loading${mobile ? " is-mobile" : " is-web"}`}
          aria-hidden
        />
      </div>
    );
  }

  if (mobile) {
    return (
      <div className="tpl-preview-modal-media is-mobile">
        <div className="tpl-preview-stage">
          <div className="tpl-preview-stage-glow" aria-hidden />
          <div className="tpl-device">
            <span className="tpl-device-btn tpl-device-btn--silent" aria-hidden />
            <span className="tpl-device-btn tpl-device-btn--vol-up" aria-hidden />
            <span className="tpl-device-btn tpl-device-btn--vol-down" aria-hidden />
            <span className="tpl-device-btn tpl-device-btn--power" aria-hidden />
            <div className="tpl-device-bezel">
              <div className="tpl-device-island" aria-hidden />
              <div className="tpl-device-screen">
                <iframe
                  ref={iframeRef}
                  className="tpl-preview-modal-frame is-mobile"
                  title={title}
                  srcDoc={html}
                  sandbox="allow-same-origin"
                  scrolling="no"
                />
              </div>
              <div className="tpl-device-home" aria-hidden />
            </div>
          </div>
          <div className="tpl-preview-stage-floor" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="tpl-preview-modal-media is-web">
      <div className="tpl-preview-stage tpl-preview-stage--web">
        <div className="tpl-preview-stage-glow tpl-preview-stage-glow--web" aria-hidden />
        <div className="tpl-browser">
          <div className="tpl-browser-chrome" aria-hidden>
            <div className="tpl-browser-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="tpl-browser-url">
              <span className="tpl-browser-lock" />
              forge.app/{templateId}
            </div>
          </div>
          <div className="tpl-browser-screen">
            <iframe
              ref={iframeRef}
              className="tpl-preview-modal-frame is-web"
              title={title}
              srcDoc={html}
              sandbox="allow-same-origin"
              scrolling="no"
            />
          </div>
        </div>
        <div className="tpl-preview-stage-floor tpl-preview-stage-floor--web" aria-hidden />
      </div>
    </div>
  );
}

export function TemplatePreviewModal({ template, busy, alert, onClose, onUse }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const isMobile = template.kind === "mobile";
  const kindLabel = isMobile ? t("templatesKindApp") : t("templatesKindWeb");
  const previewSrc =
    template.preview_url || `/templates/${template.id}/preview`;
  const showKeyAlert = alert === t("createNeedsKey");
  const showRodiAlert = alert === t("createNeedsRodi");
  const showAlert = Boolean(alert);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  const panel = (
    <div
      className="tpl-preview-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`tpl-preview-modal tpl-preview-modal--showcase${isMobile ? " tpl-preview-modal--mobile" : " tpl-preview-modal--web"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="tpl-preview-modal-header">
          <div className="tpl-preview-modal-heading">
            <h2 id={titleId}>{template.title}</h2>
            <p className="tpl-preview-modal-meta">
              <span>Forge</span>
              <span aria-hidden>·</span>
              <span>{kindLabel}</span>
              {template.tags[0] ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{template.tags[0]}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="tpl-preview-modal-actions">
            <button
              type="button"
              className="tpl-preview-modal-use"
              disabled={busy}
              onClick={onUse}
            >
              {busy ? t("forkingTemplate") : t("useTemplate")}
            </button>
            <button
              ref={closeRef}
              type="button"
              className="tpl-preview-modal-close"
              aria-label={t("templatePreviewClose")}
              disabled={busy}
              onClick={onClose}
            >
              <Icon icon={X} className="ui-icon-sm" />
            </button>
          </div>
        </header>

        <div className="tpl-preview-modal-body">
          <TemplatePreviewFrame
            templateId={template.id}
            src={previewSrc}
            title={template.title}
            mobile={isMobile}
          />

          <div className="tpl-preview-modal-aside">
            {showAlert ? (
              <p className="tpl-preview-modal-alert" role="alert">
                {alert}{" "}
                {showKeyAlert ? (
                  <Link href="/settings?tab=generation">{t("openSettings")}</Link>
                ) : null}
                {showRodiAlert ? (
                  <a
                    href={rodiumRechargeUrl(getSessionSnapshot()?.profile?.rodium_sub)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("rechargeRodi")}
                  </a>
                ) : null}
              </p>
            ) : null}

            <p className="tpl-preview-modal-desc">{template.description}</p>

            {template.boot_hint ? (
              <p className="tpl-preview-modal-hint">{template.boot_hint}</p>
            ) : null}

            {template.tags.length > 0 ? (
              <div className="tpl-preview-modal-keypoints">
                <h3>{t("templateKeyPoints")}</h3>
                <ul>
                  {template.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              className="tpl-preview-modal-use tpl-preview-modal-use-mobile"
              disabled={busy}
              onClick={onUse}
            >
              {busy ? t("forkingTemplate") : t("useTemplate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
