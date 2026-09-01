"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { api, apiBase, getToken } from "@/lib/api";
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
  /**
   * Bump to re-post the source bundle into the live runner (soft sync after a
   * visual edit) — no iframe reload, no shell/Babel refetch, no blank flash.
   */
  renderNonce?: number;
  /**
   * Detected project routes. Forwarded to the bridge, which uses them to match
   * nav labels for two-way page-picker/preview synchronization.
   */
  pages?: string[];
  previewBusy: boolean;
  previewLiveStatus?: string | null;
  previewTool: PreviewTool | null;
  projectId?: string;
  remountKey?: number;
  onPreviewToolChange: (tool: PreviewTool | null) => void;
  onStartPreview: () => void;
  onRefreshPreview?: () => void;
  onVisualEdit?: (oldText: string, newText: string) => void | Promise<void>;
  onElementSelect?: (sel: ElementSelection) => void;
  onCommentAnchor?: (sel: ElementSelection) => void;
  onImageSelect?: (sel: ImageSelection) => void;
  /** Fired when the preview app navigates (hash / history) so the page picker can sync. */
  onPreviewPathChange?: (path: string) => void;
  sidePanel?: ReactNode;
};

const WIDTH: Record<ViewportMode, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};

const TOOL_RETRY_DELAYS_MS = [50, 150, 400, 800, 1600, 3200];
const NAV_RETRY_DELAYS_MS = [0, 120, 350, 700, 1400, 2800];
const MAX_BRIDGE_PINGS = 8;

/**
 * Origin of the preview iframe, or null when it cannot be determined.
 *
 * The iframe runs LLM-generated code, so every postMessage must be addressed to
 * (and accepted from) that exact origin — never "*". A wildcard would let any
 * embedded document read the source bundle or forge visual-edit commands.
 */
function previewOrigin(previewSrc: string | null): string | null {
  if (!previewSrc) return null;
  try {
    const origin = new URL(previewSrc, window.location.href).origin;
    return origin && origin !== "null" ? origin : null;
  } catch {
    return null;
  }
}

export function PreviewPane({
  previewSrc,
  previewPath = "/",
  viewport,
  previewUpdating,
  renderNonce = 0,
  pages,
  previewBusy,
  previewLiveStatus = null,
  previewTool,
  projectId,
  remountKey = 0,
  onPreviewToolChange,
  onStartPreview,
  onRefreshPreview,
  onVisualEdit,
  onElementSelect,
  onCommentAnchor,
  onImageSelect,
  onPreviewPathChange,
  sidePanel,
}: Props) {
  const { t } = useI18n();
  const [loadError, setLoadError] = useState(false);
  const [bridgeSynced, setBridgeSynced] = useState(false);
  const [bridgeWarning, setBridgeWarning] = useState(false);
  const [editMissHint, setEditMissHint] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const toolRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bridgeWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editMissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredToolRef = useRef<PreviewTool | null>(previewTool);
  const syncedToolRef = useRef<PreviewTool | null>(null);
  const onVisualEditRef = useRef(onVisualEdit);
  const onElementSelectRef = useRef(onElementSelect);
  const onCommentAnchorRef = useRef(onCommentAnchor);
  const onImageSelectRef = useRef(onImageSelect);
  const onPreviewPathChangeRef = useRef(onPreviewPathChange);
  const previewPathRef = useRef(previewPath);
  const navigateRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  onVisualEditRef.current = onVisualEdit;
  onElementSelectRef.current = onElementSelect;
  onCommentAnchorRef.current = onCommentAnchor;
  onImageSelectRef.current = onImageSelect;
  onPreviewPathChangeRef.current = onPreviewPathChange;
  previewPathRef.current = previewPath;
  desiredToolRef.current = previewTool;

  const runnerReadyRef = useRef(false);
  const [babelError, setBabelError] = useState<string | null>(null);

  // Babel runner: push source bundle into the iframe (origin = API).
  useEffect(() => {
    if (!previewSrc || !projectId) return;
    const targetOrigin = previewOrigin(previewSrc);
    if (!targetOrigin) return;

    async function pushRender(target: string) {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      try {
        const bundle = await api<{ files: Record<string, string>; entry: string }>(
          `/projects/${projectId}/source-bundle`,
        );
        setBabelError(null);
        win.postMessage(
          {
            type: "forge:render",
            files: bundle.files,
            entry: bundle.entry || "src/main.tsx",
            // Root-path images (/images/x.png) live in the project's public/
            // folder; the runner rewrites them to this authenticated endpoint.
            assets: {
              base: `${apiBase().replace(/\/$/, "")}/projects/${projectId}/public`,
              token: getToken() ?? "",
            },
          },
          target,
        );
      } catch (err) {
        console.error("babel render push failed", err);
        setBabelError(err instanceof Error ? err.message : String(err));
        setLoadError(true);
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== targetOrigin) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "forge:ready") {
        runnerReadyRef.current = true;
        void pushRender(targetOrigin);
      }
      if (data.type === "forge:mounted") {
        // App mounted — that says nothing about the visual-edit bridge, which
        // acknowledges separately via forge-tool-ack. Conflating the two showed
        // "click to edit" next to "bridge unavailable" at the same time.
        setLoadError(false);
        setBabelError(null);
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
      void pushRender(targetOrigin);
    }, 400);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
    // renderNonce: soft sync — same iframe, fresh bundle push.
  }, [previewSrc, projectId, remountKey, renderNonce]);

  useEffect(() => {
    setLoadError(false);
  }, [previewSrc]);

  function clearNavigateRetries() {
    for (const id of navigateRetryTimers.current) clearTimeout(id);
    navigateRetryTimers.current = [];
  }

  function postPreviewNavigate(path: string) {
    const win = frameRef.current?.contentWindow;
    const target = previewOrigin(previewSrc);
    if (!win || !target) return;
    try {
      win.postMessage({ type: "forge-preview-navigate", path }, target);
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

  // Declare the detected routes to the bridge: label-matching against a known
  // set is what makes picker->preview and preview->picker sync reliable.
  useEffect(() => {
    if (!previewSrc || !bridgeSynced || !pages?.length) return;
    const win = frameRef.current?.contentWindow;
    const target = previewOrigin(previewSrc);
    if (!win || !target) return;
    try {
      win.postMessage({ type: "forge-preview-routes", paths: pages }, target);
    } catch {
      /* iframe reloading */
    }
  }, [bridgeSynced, pages, previewSrc]);

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
    const target = previewOrigin(previewSrc);
    if (!win || !target) return;
    try {
      win.postMessage({ type: "forge-tool-mode", tool }, target);
      win.postMessage({ type: "forge-tool-ping" }, target);
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

      // Bounded: if the bridge never answers, keep the warning but stop
      // hammering the iframe forever (this used to ping every 2s indefinitely).
      let attempts = 0;
      pingIntervalRef.current = setInterval(() => {
        attempts += 1;
        if (
          desiredToolRef.current !== tool ||
          syncedToolRef.current === tool ||
          attempts > MAX_BRIDGE_PINGS
        ) {
          clearPingInterval();
          return;
        }
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
    const trustedOrigin = previewOrigin(previewSrc);
    function onMessage(ev: MessageEvent) {
      // The iframe executes model-generated code: only accept its exact origin.
      if (!trustedOrigin || ev.origin !== trustedOrigin) return;
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
        if (editMissTimerRef.current) clearTimeout(editMissTimerRef.current);
        editMissTimerRef.current = setTimeout(() => setEditMissHint(null), 3200);
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
        return;
      }

      if (type === "forge-preview-location") {
        const path = typeof data.path === "string" ? data.path : "";
        if (!path) return;
        if (path === previewPathRef.current) return;
        onPreviewPathChangeRef.current?.(path);
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (editMissTimerRef.current) clearTimeout(editMissTimerRef.current);
    };
  }, [t, previewSrc]);

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
                // `allow-same-origin` is required: the runner needs a real origin so
                // both sides can pin postMessage to it (a sandboxed opaque origin
                // reports "null" and forces a wildcard, which is worse). The iframe
                // is served from the API origin, which holds no browser credentials —
                // the session token lives in the builder origin only.
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                onLoad={() => {
                  setLoadError(false);
                  runnerReadyRef.current = true;
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
