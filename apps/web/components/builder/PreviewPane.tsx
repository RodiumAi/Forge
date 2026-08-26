"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
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
  previewPath?: string;
  viewport: ViewportMode;
  previewUpdating: boolean;
  previewBusy: boolean;
  previewLiveStatus?: string | null;
  previewTool: PreviewTool | null;
  previewMode?: "vite" | "babel_runner";
  projectId?: string;
  remountKey?: number;
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

const TOOL_RETRY_DELAYS_MS = [50, 150, 400, 800, 1600, 3200];
const NAV_RETRY_DELAYS_MS = [0, 120, 350, 700, 1400, 2800];

export function PreviewPane({
  previewSrc,
  previewPath = "/",
  viewport,
  previewUpdating,
  previewBusy,
  previewLiveStatus = null,
  previewTool,
  previewMode = "babel_runner",
  projectId,
  remountKey = 0,
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
  const [bridgeSynced, setBridgeSynced] = useState(false);
  const [bridgeWarning, setBridgeWarning] = useState(false);
  const [editMissHint, setEditMissHint] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bridgeWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredToolRef = useRef<PreviewTool | null>(previewTool);
  const syncedToolRef = useRef<PreviewTool | null>(null);
  const onVisualEditRef = useRef(onVisualEdit);
  const onElementSelectRef = useRef(onElementSelect);
  const onCommentAnchorRef = useRef(onCommentAnchor);
  const onImageSelectRef = useRef(onImageSelect);
  const navigateRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  onVisualEditRef.current = onVisualEdit;
  onElementSelectRef.current = onElementSelect;
  onCommentAnchorRef.current = onCommentAnchor;
  onImageSelectRef.current = onImageSelect;
  desiredToolRef.current = previewTool;

  const runnerReadyRef = useRef(false);
  const [babelError, setBabelError] = useState<string | null>(null);

  // Babel runner: push source bundle into the iframe (origin = API).
  useEffect(() => {
    if (previewMode !== "babel_runner" || !previewSrc || !projectId) return;

    async function pushRender() {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      try {
        const bundle = await api<{ files: Record<string, string>; entry: string }>(
          `/projects/${projectId}/source-bundle`,
        );
        let targetOrigin = "*";
        try {
          targetOrigin = new URL(previewSrc).origin;
        } catch {
          /* keep * */
        }
        setBabelError(null);
        win.postMessage(
          {
            type: "forge:render",
            files: bundle.files,
            entry: bundle.entry || "src/main.tsx",
          },
          targetOrigin === "null" ? "*" : targetOrigin,
        );
      } catch (err) {
        console.error("babel render push failed", err);
        setBabelError(err instanceof Error ? err.message : String(err));
        setLoadError(true);
      }
    }

    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "forge:ready") {
        runnerReadyRef.current = true;
        void pushRender();
      }
      if (data.type === "forge:mounted") {
        setLoadError(false);
        setBabelError(null);
        setBridgeSynced(true);
      }
      if (data.type === "forge:transform-error" || data.type === "forge:error") {
        setLoadError(true);
        const err = data.error && typeof data.error === "object" ? data.error : data;
        const path = typeof err.path === "string" ? err.path : "";
        const line = err.line != null ? `:${err.line}` : "";
        const col = err.column != null ? `:${err.column}` : "";
        const msg = typeof err.message === "string" ? err.message : "Preview error";
        const loc = path ? `${path}${line}${col}` : "";
        setBabelError(loc ? `${loc} — ${msg}` : msg);
      }
    }

    window.addEventListener("message", onMessage);
    const t = window.setTimeout(() => {
      void pushRender();
    }, 400);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
  }, [previewMode, previewSrc, projectId, remountKey]);

  useEffect(() => {
    setLoadError(false);
    if (!previewSrc) return;
    if (previewMode === "babel_runner") return; // errors come via forge:error postMessage
    if (loadTimer.current) clearTimeout(loadTimer.current);
    // Same-origin only: UI is :3100, preview proxy is often :8100 → cross-origin.
    // Still try; if blocked, the always-visible restart button remains available.
    loadTimer.current = setTimeout(() => {
      try {
        const doc = frameRef.current?.contentDocument;
        if (!doc) {
          // Cross-origin: cannot inspect. Soft-hint after a delay by leaving loadError false;
          // user can still use the floating restart control.
          return;
        }
        const root = doc.getElementById("root");
        const hasNodes = Boolean(root && root.childElementCount > 0);
        if (!hasNodes && doc.readyState === "complete") {
          setLoadError(true);
        }
      } catch {
        // Cross-origin: ignore.
      }
    }, 4500);
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, [previewSrc, previewMode]);

  function clearNavigateRetries() {
    for (const id of navigateRetryTimers.current) clearTimeout(id);
    navigateRetryTimers.current = [];
  }

  function postPreviewNavigate(path: string) {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: "forge-preview-navigate", path }, "*");
    } catch {
      /* ignore */
    }
  }

  function schedulePreviewNavigate(path: string) {
    clearNavigateRetries();
    for (const delay of NAV_RETRY_DELAYS_MS) {
      const id = setTimeout(() => postPreviewNavigate(path), delay);
      navigateRetryTimers.current.push(id);
    }
  }

  useEffect(() => {
    if (!previewSrc) return;
    schedulePreviewNavigate(previewPath);
    return () => clearNavigateRetries();
  }, [previewPath, previewSrc]);

  useEffect(() => {
    if (!previewSrc || !bridgeSynced) return;
    postPreviewNavigate(previewPath);
  }, [bridgeSynced, previewPath, previewSrc]);

  function clearToolRetries() {
    for (const id of toolRetryTimers.current) clearTimeout(id);
    toolRetryTimers.current = [];
  }

  function clearPingInterval() {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }

  function clearBridgeWarnTimer() {
    if (bridgeWarnTimerRef.current) {
      clearTimeout(bridgeWarnTimerRef.current);
      bridgeWarnTimerRef.current = null;
    }
  }

  function postTool(tool: PreviewTool | null) {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: "forge-tool-mode", tool }, "*");
      win.postMessage({ type: "forge-tool-ping" }, "*");
    } catch {
      /* ignore */
    }
  }

  function markSynced(tool: PreviewTool | null) {
    syncedToolRef.current = tool;
    setBridgeSynced(true);
    setBridgeWarning(false);
    clearBridgeWarnTimer();
  }

  function syncToolWithRetries(tool: PreviewTool | null) {
    clearToolRetries();
    clearPingInterval();
    clearBridgeWarnTimer();
    setBridgeSynced(false);
    setBridgeWarning(false);
    syncedToolRef.current = null;
    desiredToolRef.current = tool;
    postTool(tool);

    if (tool) {
      bridgeWarnTimerRef.current = setTimeout(() => {
        if (desiredToolRef.current === tool && syncedToolRef.current !== tool) {
          setBridgeWarning(true);
        }
      }, 3000);

      pingIntervalRef.current = setInterval(() => {
        if (desiredToolRef.current !== tool) return;
        if (syncedToolRef.current === tool) return;
        postTool(tool);
      }, 2000);
    }

    for (const delay of TOOL_RETRY_DELAYS_MS) {
      const id = setTimeout(() => {
        if (desiredToolRef.current !== tool) return;
        if (syncedToolRef.current === tool) return;
        postTool(tool);
      }, delay);
      toolRetryTimers.current.push(id);
    }
  }

  useEffect(() => {
    syncToolWithRetries(previewTool);
    return () => {
      clearToolRetries();
      clearPingInterval();
      clearBridgeWarnTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTool, previewSrc]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      const type = data.type;

      if (type === "forge-tool-ready") {
        const tool = desiredToolRef.current;
        const readyTool = (data.tool as PreviewTool | null) ?? null;
        if (tool !== readyTool) postTool(tool);
        else markSynced(readyTool);
        return;
      }

      if (type === "forge-tool-ack") {
        const ackTool = (data.tool as PreviewTool | null) ?? null;
        if (ackTool === desiredToolRef.current) markSynced(ackTool);
        else postTool(desiredToolRef.current);
        return;
      }

      if (type === "forge-edit-miss") {
        setEditMissHint(t("previewEditMiss"));
        window.setTimeout(() => setEditMissHint(null), 3200);
        return;
      }

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
  }, [t]);

  const toolActive = Boolean(previewTool);
  const showToolHint = Boolean(previewTool && previewSrc && bridgeSynced);
  const showBridgeWarning = Boolean(previewTool && previewSrc && bridgeWarning && !bridgeSynced);

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
          {editMissHint ? (
            <div className="builder-preview-edit-badge builder-preview-edit-miss" aria-live="polite">
              {editMissHint}
            </div>
          ) : null}
          {showBridgeWarning ? (
            <div className="builder-preview-edit-badge builder-preview-bridge-warn" aria-live="polite">
              {t("previewBridgeWarn")}
            </div>
          ) : null}
          {previewTool === "text" && showToolHint ? (
            <div className="builder-preview-edit-badge" aria-live="polite">
              {t("previewTextEditHint")}
            </div>
          ) : null}
          {previewTool === "select" && showToolHint ? (
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
                sandbox={
                  previewMode === "babel_runner"
                    ? "allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                    : undefined
                }
                onLoad={() => {
                  setLoadError(false);
                  if (previewMode === "babel_runner") {
                    runnerReadyRef.current = true;
                  } else {
                    syncToolWithRetries(desiredToolRef.current);
                    schedulePreviewNavigate(previewPath);
                  }
                }}
              />
              {loadError && (
                <div className="builder-preview-recover">
                  <p>{babelError || t("previewBlankHint")}</p>
                  <button
                    type="button"
                    className="btn builder-preview-recover-btn"
                    onClick={() => {
                      setLoadError(false);
                      setBabelError(null);
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
              <p>
                {previewBusy || previewLiveStatus === "starting"
                  ? t("builderStarting")
                  : previewLiveStatus === "dead"
                    ? t("previewBlankHint")
                    : t("previewEmpty")}
              </p>
              {!previewBusy && previewLiveStatus !== "starting" && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (previewLiveStatus === "dead") {
                      onRefreshPreview?.();
                    } else {
                      onStartPreview();
                    }
                  }}
                >
                  {previewLiveStatus === "dead" ? t("restartPreview") : t("startPreview")}
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
