"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, Link2, MessageSquare, PencilLine, RotateCw, Sparkles } from "lucide-react";
import { api, apiBase } from "@/lib/api";
import { getMediaToken } from "@/lib/media-token";
import { uploadProjectThumbnail } from "@/lib/project-thumbnail";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { ContextMenu, copyText, useContextMenu, type ContextMenuEntry } from "@/components/ui/ContextMenu";
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
  onVisualEdit?: (oldText: string, newText: string, forgeId?: string | null) => void | Promise<void>;

  onElementSelect?: (sel: ElementSelection) => void;
  onCommentAnchor?: (sel: ElementSelection) => void;
  onImageSelect?: (sel: ImageSelection) => void;
  /** Fired when the preview app navigates (hash / history) so the page picker can sync. */
  onPreviewPathChange?: (path: string) => void;
  /**
   * Pages rail: receives a small picture of the page on screen once it has
   * settled (after a load, a navigation or a re-render). Omit to capture nothing.
   */
  onPageSnapshot?: (path: string, dataUrl: string) => void;
  sidePanel?: ReactNode;
  /**
   * While the agent is generating / repairing, hide the blocking Babel overlay
   * so mid-run broken imports (IMPORT_NOT_IN_MANIFEST, etc.) don't interrupt UX.
   * Errors still log to the console; the overlay returns once this is false.
   */
  suppressErrorOverlay?: boolean;
};

const WIDTH: Record<ViewportMode, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};

const TOOL_RETRY_DELAYS_MS = [50, 150, 400, 800, 1600, 3200];
const NAV_RETRY_DELAYS_MS = [0, 120, 350, 700, 1400, 2800];
const MAX_BRIDGE_PINGS = 8;
/** Settle time before the pages rail snapshot (fonts, images, entrance animations). */
const PAGE_CAPTURE_DELAY_MS = 1400;

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
  onPageSnapshot,
  sidePanel,
  suppressErrorOverlay = false,
}: Props) {
  const { t } = useI18n();
  const [loadError, setLoadError] = useState(false);
  const [bridgeSynced, setBridgeSynced] = useState(false);
  const [bridgeWarning, setBridgeWarning] = useState(false);
  const [editMissHint, setEditMissHint] = useState<string | null>(null);
  const menu = useContextMenu();
  const openMenuRef = useRef<(data: Record<string, unknown>) => void>(() => undefined);
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
  const onPageSnapshotRef = useRef(onPageSnapshot);
  const viewportRef = useRef(viewport);
  const previewToolRef = useRef(previewTool);
  const pageCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageCaptureReqRef = useRef<{ id: string; path: string } | null>(null);
  const pageCaptureSeqRef = useRef(0);
  const previewPathRef = useRef(previewPath);
  const suppressErrorOverlayRef = useRef(suppressErrorOverlay);
  const pendingThumbRef = useRef(false);
  const thumbUploadingRef = useRef(false);
  const wasWorkingRef = useRef(suppressErrorOverlay);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const navigateRetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  onVisualEditRef.current = onVisualEdit;
  onElementSelectRef.current = onElementSelect;
  onCommentAnchorRef.current = onCommentAnchor;
  onImageSelectRef.current = onImageSelect;
  onPreviewPathChangeRef.current = onPreviewPathChange;
  onPageSnapshotRef.current = onPageSnapshot;
  viewportRef.current = viewport;
  previewToolRef.current = previewTool;
  previewPathRef.current = previewPath;
  suppressErrorOverlayRef.current = suppressErrorOverlay;
  desiredToolRef.current = previewTool;

  const runnerReadyRef = useRef(false);
  // True once the app mounted in the iframe: later runtime errors must not
  // slam the blocking "Restart preview" overlay over a site that still works.
  const appMountedRef = useRef(false);
  const [babelError, setBabelError] = useState<string | null>(null);
  const thumbCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function requestThumbCapture() {
    const win = frameRef.current?.contentWindow;
    const target = previewOrigin(previewSrc);
    const pid = projectIdRef.current;
    if (!win || !target || !pid || thumbUploadingRef.current) return;
    pendingThumbRef.current = true;
    try {
      win.postMessage({ type: "forge:capture-thumb" }, target);
    } catch {
      /* ignore */
    }
  }

  /**
   * Pages rail: ask the runner for a snapshot of the page on screen once it
   * settled. Debounced; skipped mid-run (half-written bundle) and while a
   * tool overlay is active. The reply is filed under the route asked for,
   * and dropped if the preview moved to another page meanwhile.
   */
  function schedulePageCapture(delay = PAGE_CAPTURE_DELAY_MS) {
    if (!onPageSnapshotRef.current) return;
    if (pageCaptureTimerRef.current) clearTimeout(pageCaptureTimerRef.current);
    pageCaptureTimerRef.current = setTimeout(() => {
      pageCaptureTimerRef.current = null;
      if (!onPageSnapshotRef.current || !appMountedRef.current) return;
      if (suppressErrorOverlayRef.current || previewToolRef.current) return;
      const win = frameRef.current?.contentWindow;
      const target = previewOrigin(previewSrc);
      if (!win || !target) return;
      pageCaptureSeqRef.current += 1;
      const req = { id: `page-${pageCaptureSeqRef.current}`, path: previewPathRef.current || "/" };
      pageCaptureReqRef.current = req;
      try {
        win.postMessage(
          { type: "forge:capture-page", requestId: req.id, width: viewportRef.current === "phone" ? 240 : 320 },
          target,
        );
      } catch {
        /* iframe reloading: the next mount schedules another capture */
      }
    }, delay);
  }

  useEffect(
    () => () => {
      if (pageCaptureTimerRef.current) clearTimeout(pageCaptureTimerRef.current);
    },
    [],
  );

  // A new page on screen, the end of a run, or a tool closed: snapshot again.
  useEffect(() => {
    if (!previewSrc || suppressErrorOverlay || previewTool) return;
    schedulePageCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture reads refs at call time
  }, [previewPath, previewSrc, suppressErrorOverlay, previewTool, Boolean(onPageSnapshot)]);

  // After an agent run (working → idle), ask the runner for a JPEG and persist it.
  useEffect(() => {
    const was = wasWorkingRef.current;
    wasWorkingRef.current = suppressErrorOverlay;
    if (thumbCaptureTimerRef.current) {
      clearTimeout(thumbCaptureTimerRef.current);
      thumbCaptureTimerRef.current = null;
    }
    if (!(was && !suppressErrorOverlay && projectId)) return;
    // Debounce: mid-plan verify can flicker working; wait for a settled idle.
    thumbCaptureTimerRef.current = setTimeout(() => {
      thumbCaptureTimerRef.current = null;
      if (suppressErrorOverlayRef.current) return;
      pendingThumbRef.current = true;
      if (appMountedRef.current) requestThumbCapture();
    }, 1200);
    return () => {
      if (thumbCaptureTimerRef.current) {
        clearTimeout(thumbCaptureTimerRef.current);
        thumbCaptureTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture uses refs + previewSrc at call time
  }, [suppressErrorOverlay, projectId]);

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
              // The runner appends this to `<img src>` URLs, so it must be the
              // read-only media token — a session token here would end up in
              // the API's access logs on every asset the preview loads.
              token: getMediaToken() ?? "",
              routerBase: "/runner",
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
        appMountedRef.current = true;
        setLoadError(false);
        setBabelError(null);
        if (pendingThumbRef.current) requestThumbCapture();
        schedulePageCapture();
      }
      if (data.type === "forge:page-snapshot") {
        const req = pageCaptureReqRef.current;
        if (!req || data.requestId !== req.id) return;
        pageCaptureReqRef.current = null;
        if (typeof data.dataUrl !== "string" || req.path !== previewPathRef.current) return;
        onPageSnapshotRef.current?.(req.path, data.dataUrl);
      }
      if (
        data.type === "forge:thumb-snapshot" &&
        typeof data.dataUrl === "string" &&
        pendingThumbRef.current &&
        projectIdRef.current
      ) {
        pendingThumbRef.current = false;
        if (thumbUploadingRef.current) return;
        thumbUploadingRef.current = true;
        const pid = projectIdRef.current;
        void uploadProjectThumbnail(pid, data.dataUrl).finally(() => {
          thumbUploadingRef.current = false;
        });
      }
      if (data.type === "forge:transform-error" || data.type === "forge:error") {
        const err = data.error && typeof data.error === "object" ? data.error : data;
        const msg = typeof err.message === "string" ? err.message : "Preview error";
        // Known-benign DOM noise (bridge/contentEditable vs React reconciliation,
        // stale selectors): never block the preview for these.
        const benign =
          /removeChild|insertBefore|not a child of this node|is not a valid selector|ResizeObserver loop/i.test(
            msg,
          );
        // Runtime error AFTER a successful mount: the site is still rendered —
        // opening the same app in a new tab shows no blocking overlay either.
        const afterMount = data.type === "forge:error" && appMountedRef.current;
        // During agent generation / mid-plan repair the bundle is often briefly
        // inconsistent (IMPORT_NOT_IN_MANIFEST, half-written files). Keep the
        // canvas quiet and let verify/repair finish behind the scenes.
        if (benign || afterMount || suppressErrorOverlayRef.current) {
          console.debug("[forge] preview runtime error (non-blocking):", msg);
          return;
        }
        setLoadError(true);
        const path = typeof err.path === "string" ? err.path : "";
        const line = err.line != null ? `:${err.line}` : "";
        const col = err.column != null ? `:${err.column}` : "";
        const loc = path ? `${path}${line}${col}` : "";
        setBabelError(loc ? `${loc} — ${msg}` : msg);
      }
    }

    window.addEventListener("message", onMessage);
    const t = window.setTimeout(() => {
      // Only push once the iframe actually loaded the runner: posting into a
      // not-yet-navigated frame (about:blank inherits the parent origin)
      // spammed "target origin does not match" console errors on every push.
      if (runnerReadyRef.current) void pushRender(targetOrigin);
    }, 400);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
    // renderNonce: soft sync — same iframe, fresh bundle push.
  }, [previewSrc, projectId, remountKey, renderNonce]);

  useEffect(() => {
    setLoadError(false);
    appMountedRef.current = false;
    runnerReadyRef.current = false;
  }, [previewSrc]);

  // Clear any stale blocking overlay when a run starts (or resumes).
  useEffect(() => {
    if (suppressErrorOverlay) {
      setLoadError(false);
      setBabelError(null);
    }
  }, [suppressErrorOverlay]);

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

  function postAction(action: string) {
    const win = frameRef.current?.contentWindow;
    const target = previewOrigin(previewSrc);
    if (!win || !target) return;
    try {
      win.postMessage({ type: "forge-context-action", action }, target);
    } catch {
      /* ignore */
    }
  }

  /** Right click or long press in the preview: the bridge says what sits under it. */
  openMenuRef.current = (data) => {
    const frame = frameRef.current;
    if (!frame) return;
    const box = frame.getBoundingClientRect();
    const scale = frame.offsetWidth ? box.width / frame.offsetWidth : 1;
    const x = typeof data.x === "number" ? data.x : 0;
    const y = typeof data.y === "number" ? data.y : 0;
    const at = { x: Math.round(box.left + x * scale), y: Math.round(box.top + y * scale) };
    const ico = (Icon: typeof Copy) => <Icon size={16} aria-hidden />;
    const raw = data.element && typeof data.element === "object" ? (data.element as Record<string, unknown>) : null;
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const element: ElementSelection | null = raw
      ? {
          tag: str(raw.tag) || "div",
          id: str(raw.id),
          className: str(raw.className),
          selector: str(raw.selector) || "",
          text: str(raw.text) || "",
          forgeId: str(raw.forgeId),
        }
      : null;
    const img = data.image && typeof data.image === "object" ? (data.image as Record<string, unknown>) : null;
    const image: ImageSelection | null = img
      ? { src: str(img.src) || "", alt: str(img.alt) || "", selector: str(img.selector) || "", forgeId: str(img.forgeId) }
      : null;
    const selection = str(data.selection) || "";
    const link = str(data.link);
    const items: ContextMenuEntry[] = [];
    if (data.editable === true && onVisualEditRef.current) {
      items.push({ id: "edit-text", label: t("bdMenuEditText"), icon: ico(PencilLine), onSelect: () => postAction("edit-text") });
    }
    if (image && onImageSelectRef.current) {
      items.push({
        id: "image",
        label: t("bdMenuReplaceImage"),
        icon: ico(ImagePlus),
        onSelect: () => {
          onPreviewToolChange("image");
          onImageSelectRef.current?.(image);
        },
      });
    }
    if (element && onElementSelectRef.current) {
      items.push({ id: "ask", label: t("bdMenuAskElement"), icon: ico(Sparkles), onSelect: () => onElementSelectRef.current?.(element) });
    }
    if (element && onCommentAnchorRef.current) {
      items.push({
        id: "comment",
        label: t("bdMenuComment"),
        icon: ico(MessageSquare),
        onSelect: () => {
          onPreviewToolChange("comment");
          onCommentAnchorRef.current?.(element);
        },
      });
    }
    items.push({ type: "separator" });
    if (selection) items.push({ id: "copy", label: t("bdMenuCopy"), icon: ico(Copy), onSelect: () => copyText(selection) });
    if (link) items.push({ id: "copy-link", label: t("bdMenuCopyLink"), icon: ico(Link2), onSelect: () => copyText(link) });
    items.push({ type: "separator" });
    if (onRefreshPreview) items.push({ id: "reload", label: t("bdMenuReload"), icon: ico(RotateCw), onSelect: onRefreshPreview });
    menu.open(at, items, t("bdMenuPreview"));
  };

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

      if (type === "forge-context-menu") {
        openMenuRef.current(data as Record<string, unknown>);
        return;
      }

      if (type === "forge-tool-escape") {
        onPreviewToolChange(null);
        return;
      }

      if (type === "forge-visual-edit") {
        const oldText = typeof data.oldText === "string" ? data.oldText : "";
        const newText = typeof data.newText === "string" ? data.newText : "";
        const forgeId = typeof data.forgeId === "string" ? data.forgeId : null;
        if (!oldText || newText === oldText) return;
        const win = frameRef.current?.contentWindow;
        const target = trustedOrigin;
        void (async () => {
          try {
            await onVisualEditRef.current?.(oldText, newText, forgeId);
            if (win && target) win.postMessage({ type: "forge-visual-edit-ok" }, target);
          } catch {
            if (win && target) win.postMessage({ type: "forge-visual-edit-failed" }, target);
          }
        })();
        return;
      }

      if (type === "forge-element-select" || type === "forge-comment-anchor") {
        const sel: ElementSelection = {
          tag: typeof data.tag === "string" ? data.tag : "div",
          id: typeof data.id === "string" ? data.id : null,
          className: typeof data.className === "string" ? data.className : null,
          selector: typeof data.selector === "string" ? data.selector : "",
          text: typeof data.text === "string" ? data.text : "",
          forgeId: typeof data.forgeId === "string" ? data.forgeId : null,
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
          forgeId: typeof data.forgeId === "string" ? data.forgeId : null,
        });
        return;
      }

      if (type === "forge-preview-location") {
        const raw = typeof data.path === "string" ? data.path : "";
        if (!raw) return;
        // `/#tarifs` is a section of the page on screen, never a page of its
        // own: an older bridge reported it as one and it filled the rail.
        const path = raw.includes("#") ? raw.split("#")[0] || "/" : raw;
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
    <section className={`f-bd-preview${toolActive ? " is-tool" : ""}`} data-viewport={viewport}>
      <div className="f-bd-preview-stage">
        {editMissHint ? (
          <div className="f-bd-hint warn" aria-live="polite">
            {editMissHint}
          </div>
        ) : null}
        {showBridgeWarning ? (
          <div className="f-bd-hint warn" aria-live="polite">
            {t("previewBridgeWarn")}
          </div>
        ) : null}
        {previewTool === "text" && showToolHint ? (
          <div className="f-bd-hint" aria-live="polite">
            {t("previewTextEditHint")}
          </div>
        ) : null}
        {previewTool === "select" && showToolHint ? (
          <div className="f-bd-hint" aria-live="polite">
            {t("previewSelectHint")}
          </div>
        ) : null}
        {previewSrc ? (
          <div className="f-bd-frame" data-d={viewport} style={{ width: WIDTH[viewport] }}>
            <iframe
              ref={frameRef}
              title="preview"
              src={previewSrc}
              // `allow-same-origin` is required: the runner needs a real origin so
              // both sides can pin postMessage to it (a sandboxed opaque origin
              // reports "null" and forces a wildcard, which is worse). The iframe
              // is served from the API origin, which holds no browser credentials:
              // the session token lives in the builder origin only.
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              onLoad={() => {
                setLoadError(false);
                runnerReadyRef.current = true;
              }}
            />
            {loadError && (
              <div className="f-bd-frame-recover">
                <p>{babelError || t("previewBlankHint")}</p>
                <Button
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    setLoadError(false);
                    setBabelError(null);
                    onRefreshPreview?.();
                    onStartPreview();
                  }}
                >
                  {t("restartPreview")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="f-bd-placeholder">
            {previewBusy || previewLiveStatus === "starting" ? <Glyph name="refresh" className="f-spin" /> : null}
            <p style={{ margin: 0 }}>
              {previewBusy || previewLiveStatus === "starting"
                ? t("builderStarting")
                : previewLiveStatus === "dead"
                  ? t("previewBlankHint")
                  : t("previewEmpty")}
            </p>
            {!previewBusy && previewLiveStatus !== "starting" && (
              <Button
                size="sm"
                icon={previewLiveStatus === "dead" ? "refresh" : "play"}
                onClick={() => {
                  if (previewLiveStatus === "dead") {
                    onRefreshPreview?.();
                  } else {
                    onStartPreview();
                  }
                }}
              >
                {previewLiveStatus === "dead" ? t("restartPreview") : t("startPreview")}
              </Button>
            )}
          </div>
        )}
        {previewSrc ? (
          <PreviewToolbar
            key={viewport}
            tool={previewTool}
            onToolChange={onPreviewToolChange}
            defaultCollapsed={viewport === "phone"}
          />
        ) : null}
      </div>
      {sidePanel ? <aside className="f-bd-side">{sidePanel}</aside> : null}
      <ContextMenu request={menu.request} onClose={menu.close} />
    </section>
  );
}
