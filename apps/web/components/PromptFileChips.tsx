"use client";

import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { assetContentUrl, isPrivateUploadUrl } from "@/lib/asset-url";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  attachmentName,
  attachmentObjectId,
  attachmentPreviewUrl,
  type PromptAttachment,
} from "@/lib/prompt-attachments";

type PromptFileChipsProps = {
  items: PromptAttachment[];
  onRemove: (id: string) => void;
  /** Needed to resolve private MinIO thumbs via authenticated proxy. */
  projectId?: string | null;
  /** Upload progress per attachment id (0-100); shows a bar while defined. */
  progress?: Record<string, number>;
};

function resolveChipThumb(
  item: PromptAttachment,
  projectId?: string | null,
): string | null {
  const objectId = attachmentObjectId(item);
  if (projectId && objectId) {
    const durable = assetContentUrl(projectId, objectId);
    if (durable) return durable;
  }
  const preview = attachmentPreviewUrl(item);
  if (preview && !isPrivateUploadUrl(preview)) {
    return preview;
  }
  // Local blob previews still OK.
  if (preview?.startsWith("blob:")) return preview;
  return preview;
}

export function PromptFileChips({ items, onRemove, projectId, progress }: PromptFileChipsProps) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [preview]);

  if (!items.length) return null;

  return (
    <>
      <div className="landing-files">
        {items.map((item) => {
          const name = attachmentName(item);
          const thumb = resolveChipThumb(item, projectId);
          const isImage = item.kind === "image";
          const pct = progress?.[item.id];
          const uploading = typeof pct === "number" && pct < 100;
          return (
            <div
              key={item.id}
              className={`landing-file-chip ${isImage ? "landing-file-chip-image" : ""}${uploading ? " is-uploading" : ""}`}
              title={name}
            >
              {isImage && thumb ? (
                <button
                  type="button"
                  className="landing-file-thumb-btn"
                  onClick={() => setPreview({ src: thumb, name })}
                  aria-label={t("attachmentPreviewOpen")}
                >
                  { }
                  <img src={thumb} alt="" className="landing-file-thumb" />
                </button>
              ) : (
                <span className="landing-file-doc" aria-hidden>
                  <Icon icon={FileText} className="ui-icon-sm" />
                  <span className="landing-file-ext">{item.kind.toUpperCase()}</span>
                </span>
              )}
              <span className="landing-file-name">{name}</span>
              {typeof pct === "number" ? (
                <span className="landing-file-progress" aria-live="polite">
                  <span className="landing-file-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <span className="landing-file-progress-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="landing-file-progress-pct">{pct}%</span>
                </span>
              ) : null}
              {item.source === "project" ? (
                <span className="landing-file-ref" aria-hidden>
                  @
                </span>
              ) : null}
              <button
                type="button"
                className="landing-file-remove"
                onClick={() => onRemove(item.id)}
                aria-label={t("attachmentRemove")}
                title={t("attachmentRemove")}
              >
                <Icon icon={X} className="ui-icon-sm" />
              </button>
            </div>
          );
        })}
      </div>

      {preview ? (
        <div className="attachment-lightbox-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="attachment-lightbox-backdrop"
            aria-label={t("close")}
            onClick={() => setPreview(null)}
          />
          <div className="attachment-lightbox">
            <header className="attachment-lightbox-head">
              <span className="attachment-lightbox-name">{preview.name}</span>
              <button
                type="button"
                className="attachment-lightbox-close"
                onClick={() => setPreview(null)}
                aria-label={t("close")}
              >
                <Icon icon={X} className="ui-icon-md" />
              </button>
            </header>
            { }
            <img src={preview.src} alt={preview.name} className="attachment-lightbox-img" />
          </div>
        </div>
      ) : null}
    </>
  );
}
