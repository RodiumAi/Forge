"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PreviewToolbar } from "./PreviewToolbar";
import type {
  ElementSelection,
  ImageSelection,
  PreviewTool,
  ViewportMode,
} from "./types";

type Props = {
  previewSrc: string | null;
  viewport: ViewportMode;
  previewUpdating: boolean;
  previewBusy: boolean;
  previewTool: PreviewTool | null;
  onPreviewToolChange: (tool: PreviewTool | null) => void;
  onStartPreview: () => void;
  onRefreshPreview?: () => void;
  onVisualEdit?: (oldText: string, newText: string) => void | Promise<void>;
  onElementSelect?: (sel: ElementSelection) => void;
  onCommentAnchor?: (sel: ElementSelection) => void;
  onImageSelect?: (sel: ImageSelection) => void;
  sidePanel?: ReactNode;
};

const WIDTH: Record<ViewportMode, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};

export function PreviewPane({
  previewSrc,
  viewport,
  previewUpdating,
  previewBusy,
  previewTool,
  onPreviewToolChange,
  onStartPreview,
  onRefreshPreview,
  onVisualEdit,
  onElementSelect,
  onCommentAnchor,
  onImageSelect,
  sidePanel,
}: Props) {
  const { t } = useI18n();
  const [loadError, setLoadError] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVisualEditRef = useRef(onVisualEdit);
  const onElementSelectRef = useRef(onElementSelect);
  const onCommentAnchorRef = useRef(onCommentAnchor);
  const onImageSelectRef = useRef(onImageSelect);
  onVisualEditRef.current = onVisualEdit;
  onElementSelectRef.current = onElementSelect;
  onCommentAnchorRef.current = onCommentAnchor;
  onImageSelectRef.current = onImageSelect;

  useEffect(() => {
    setLoadError(false);
    if (!previewSrc) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      try {
        const doc = frameRef.current?.contentDocument;
        if (!doc) return;
        const root = doc.getElementById("root");
        const hasNodes = Boolean(root && root.childElementCount > 0);
        if (!hasNodes && doc.readyState === "complete") {
          setLoadError(true);
        }
      } catch {
        // Cross-origin: cannot inspect — ignore.
      }
    }, 4500);
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, [previewSrc]);

  function postTool(tool: PreviewTool | null) {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: "forge-tool-mode", tool }, "*");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    postTool(previewTool);
  }, [previewTool, previewSrc]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      const type = data.type;
      if (type === "forge-visual-edit") {
        const oldText = typeof data.oldText === "string" ? data.oldText : "";
        const newText = typeof data.newText === "string" ? data.newText : "";
        if (!oldText || newText === oldText) return;
        void onVisualEditRef.current?.(oldText, newText);
        return;
      }
      if (type === "forge-element-select" || type === "forge-comment-anchor") {
        const sel: ElementSelection = {
          tag: typeof data.tag === "string" ? data.tag : "div",
          id: typeof data.id === "string" ? data.id : null,
          className: typeof data.className === "string" ? data.className : null,
          selector: typeof data.selector === "string" ? data.selector : "",
          text: typeof data.text === "string" ? data.text : "",
        };
        if (type === "forge-element-select") onElementSelectRef.current?.(sel);
        else onCommentAnchorRef.current?.(sel);
        return;
      }
      if (type === "forge-image-select") {
        onImageSelectRef.current?.({
          src: typeof data.src === "string" ? data.src : "",
          alt: typeof data.alt === "string" ? data.alt : "",
          selector: typeof data.selector === "string" ? data.selector : "",
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const toolActive = Boolean(previewTool);

  return (
    <section
      className={`builder-preview builder-main-pane${toolActive ? " builder-preview-tool-active" : ""}`}
    >
      <div className="builder-preview-layout">
        <div className={`builder-preview-stage viewport-${viewport}`}>
          {previewUpdating && (
            <div className="builder-preview-updating" aria-live="polite">
              {t("previewUpdating")}
            </div>
          )}
          {previewTool === "text" && previewSrc ? (
            <div className="builder-preview-edit-badge" aria-live="polite">
              {t("previewTextEditHint")}
            </div>
          ) : null}
          {previewTool === "select" && previewSrc ? (
            <div className="builder-preview-edit-badge" aria-live="polite">
              {t("previewSelectHint")}
            </div>
          ) : null}
          {previewSrc ? (
            <div className="builder-viewport-frame" style={{ width: WIDTH[viewport] }}>
              <iframe
                ref={frameRef}
                title="preview"
                src={previewSrc}
                className="builder-preview-frame"
                onLoad={() => {
                  setLoadError(false);
                  postTool(previewTool);
                }}
              />
              {loadError && (
                <div className="builder-preview-recover">
                  <p>{t("previewBlankHint")}</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLoadError(false);
                      onRefreshPreview?.();
                      onStartPreview();
                    }}
                  >
                    {t("restartPreview")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="builder-preview-placeholder">
              <p>{previewBusy ? t("builderStarting") : t("previewEmpty")}</p>
              {!previewBusy && (
                <button type="button" className="btn" onClick={onStartPreview}>
                  {t("startPreview")}
                </button>
              )}
            </div>
          )}
          {previewSrc ? (
            <PreviewToolbar tool={previewTool} onToolChange={onPreviewToolChange} />
          ) : null}
        </div>
        {sidePanel}
      </div>
    </section>
  );
}
