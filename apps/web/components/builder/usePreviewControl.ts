"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiBase } from "@/lib/api";
import { buildPreviewSrc } from "@/lib/preview-state";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";

type PreviewStatusResponse = {
  running: boolean;
  url: string | null;
  mode?: string;
  runner_url?: string | null;
};

export type RefreshOptions = {
  /** Check the server first and start the preview if it is not running. */
  softStart?: boolean;
  /** Bump the remount key (default true). */
  remount?: boolean;
  /** Ask the server for a clean restart. */
  restart?: boolean;
};

type Params = {
  projectId: string;
  /** Auto-start is deferred until the project finished loading. */
  loading: boolean;
  onError: (message: string) => void;
  previewFailedLabel: string;
};

/**
 * Owns the preview lifecycle: URL, remount key, busy/updating flags, the debounced
 * refresh, and the Firestore live status. Extracted from the builder page, which
 * carried all of it inline among ~40 other pieces of state.
 */
export function usePreviewControl({ projectId, loading, onError, previewFailedLabel }: Params) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [previewLiveStatus, setPreviewLiveStatus] = useState<string | null>(null);
  // Bumped to re-post the source bundle into the ALREADY LOADED runner iframe.
  // Visual edits used to remount the iframe (new ?t= src): full shell + Babel
  // reload and a blank flash, only to re-render content the bridge had already
  // patched optimistically in place.
  const [renderNonce, setRenderNonce] = useState(0);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStarted = useRef(false);

  const previewSrc = useMemo(
    () => buildPreviewSrc(previewUrl, previewKey, apiBase()),
    [previewUrl, previewKey],
  );

  const remount = useCallback(() => setPreviewKey((k) => k + 1), []);

  const startPreview = useCallback(async () => {
    setPreviewBusy(true);
    try {
      const status = await api<PreviewStatusResponse>(`/projects/${projectId}/preview/start`, {
        method: "POST",
      });
      setPreviewUrl(status.runner_url || status.url);
      remount();
    } catch (err) {
      onError(err instanceof Error ? err.message : previewFailedLabel);
    } finally {
      setPreviewBusy(false);
    }
  }, [onError, previewFailedLabel, projectId, remount]);

  const forcePreviewRefresh = useCallback(
    async (opts?: RefreshOptions) => {
      const shouldRemount = opts?.remount !== false;
      setPreviewUpdating(true);
      if (updatingTimer.current) clearTimeout(updatingTimer.current);
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      if (opts?.restart) {
        try {
          const status = await api<PreviewStatusResponse>(
            `/projects/${projectId}/preview/restart`,
            { method: "POST" },
          );
          if (status.url) setPreviewUrl(status.runner_url || status.url);
          if (shouldRemount) remount();
        } catch (err) {
          // Fall back to a plain start if restart is unavailable.
          await startPreview();
          if (shouldRemount) remount();
          onError(err instanceof Error ? err.message : previewFailedLabel);
        }
      } else if (opts?.softStart) {
        try {
          const status = await api<PreviewStatusResponse>(`/projects/${projectId}/preview`);
          if (!status.running || !status.url) {
            await startPreview();
          } else {
            setPreviewUrl(status.runner_url || status.url);
            if (shouldRemount) remount();
          }
        } catch {
          await startPreview();
        }
      } else if (shouldRemount) {
        remount();
      }

      updatingTimer.current = setTimeout(() => {
        setPreviewUpdating(false);
        updatingTimer.current = null;
      }, 1600);
    },
    [onError, previewFailedLabel, projectId, remount, startPreview],
  );

  /** Debounced restart, so a burst of agent writes triggers a single reload. */
  const schedulePreviewRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void forcePreviewRefresh({ restart: true });
    }, 900);
  }, [forcePreviewRefresh]);

  /** Short "updating" flash after an optimistic in-place edit. */
  const flashUpdating = useCallback((ms = 1200) => {
    setPreviewUpdating(true);
    if (updatingTimer.current) clearTimeout(updatingTimer.current);
    updatingTimer.current = setTimeout(() => {
      setPreviewUpdating(false);
      updatingTimer.current = null;
    }, ms);
  }, []);

  /** Soft sync after a visual edit: re-push the bundle, keep the iframe alive. */
  const repushPreview = useCallback(() => {
    setRenderNonce((n) => n + 1);
    flashUpdating();
  }, [flashUpdating]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (updatingTimer.current) clearTimeout(updatingTimer.current);
    },
    [],
  );

  useEffect(() => {
    // Only real lifecycle work (start/restart) reaches the global loader.
    // previewUpdating fires on every visual edit and mostly flagged a refresh
    // that did nothing visible — the local preview badge covers that.
    if (previewBusy) topProgressStart("preview");
    else topProgressDone("preview");
  }, [previewBusy]);

  // Start the preview once, after the project is loaded.
  useEffect(() => {
    if (loading || previewUrl || previewBusy || autoStarted.current) return;
    autoStarted.current = true;
    void startPreview();
  }, [loading, previewBusy, previewUrl, startPreview]);

  // Light status poll (visible tab only): detects a runner stopped/restarted
  // server-side. Replaced the Firestore live mirror — a heavyweight dependency
  // for what a 20s GET covers.
  useEffect(() => {
    if (!projectId) return;
    let stopped = false;

    async function tick() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const status = await api<PreviewStatusResponse>(`/projects/${projectId}/preview`);
        if (stopped) return;
        setPreviewLiveStatus(status.running ? "ready" : "stopped");
        const url = status.runner_url || status.url;
        if (status.running && url) {
          setPreviewUrl((prev) => (prev === url ? prev : url));
        }
      } catch {
        /* transient network error — next tick retries */
      }
    }

    const interval = window.setInterval(() => void tick(), 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [projectId]);

  return {
    previewUrl,
    setPreviewUrl,
    previewSrc,
    previewKey,
    previewBusy,
    previewUpdating,
    previewLiveStatus,
    renderNonce,
    startPreview,
    forcePreviewRefresh,
    schedulePreviewRefresh,
    flashUpdating,
    repushPreview,
  };
}
