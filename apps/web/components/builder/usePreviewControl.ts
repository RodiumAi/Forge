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
  /** Background-triggered refresh: never surface errors in the chat. */
  quiet?: boolean;
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
  // Ref mirror so the debounced refresh reads the CURRENT url, not a stale closure.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);
  // Same reason, for the busy flag: the SSE handler is captured once when a run
  // opens and lives for its whole duration, so anything it reads from state is
  // frozen at that instant.
  const previewBusyRef = useRef(false);
  useEffect(() => {
    previewBusyRef.current = previewBusy;
  }, [previewBusy]);
  /** In-flight `POST /preview/start`, so concurrent callers share one request. */
  const startInFlight = useRef<Promise<void> | null>(null);
  /** While true, the "updating" badge stays lit instead of flashing per event. */
  const holdUpdatingRef = useRef(false);

  /** Short "updating" flash after an optimistic in-place edit. */
  const flashUpdating = useCallback((ms = 1200) => {
    setPreviewUpdating(true);
    if (updatingTimer.current) clearTimeout(updatingTimer.current);
    updatingTimer.current = setTimeout(() => {
      setPreviewUpdating(false);
      updatingTimer.current = null;
    }, ms);
  }, []);

  const previewSrc = useMemo(
    () => buildPreviewSrc(previewUrl, previewKey, apiBase()),
    [previewUrl, previewKey],
  );

  const remount = useCallback(() => setPreviewKey((k) => k + 1), []);

  const startPreview = useCallback(
    async (opts?: { quiet?: boolean }) => {
      // Single-flight. Without it, two callers arriving together each POST
      // /preview/start and each resolve into a remount — two iframe
      // navigations for one logical event.
      if (startInFlight.current) return startInFlight.current;

      const run = (async () => {
        setPreviewBusy(true);
        previewBusyRef.current = true;
        try {
          const status = await api<PreviewStatusResponse>(`/projects/${projectId}/preview/start`, {
            method: "POST",
            timeoutMs: 45_000,
          });
          const url = status.runner_url || status.url;
          previewUrlRef.current = url;
          setPreviewUrl(url);
          remount();
        } catch (err) {
          // Background auto-starts (fired on agent file writes) must not spam
          // the chat with "Request timed out after 90000ms" while the backend
          // is busy generating.
          if (!opts?.quiet) onError(err instanceof Error ? err.message : previewFailedLabel);
        } finally {
          setPreviewBusy(false);
          previewBusyRef.current = false;
          startInFlight.current = null;
        }
      })();

      startInFlight.current = run;
      return run;
    },
    [onError, previewFailedLabel, projectId, remount],
  );

  /**
   * Start the preview only if it is not already up or starting.
   *
   * Reads the REFS, never state. The builder's SSE handler calls this from a
   * closure captured when the run opened; reading `previewUrl` from there saw
   * whatever it was at that instant — usually null on a first generation — so
   * the guard never fired and every file write remounted the iframe.
   */
  const ensurePreviewStarted = useCallback(() => {
    if (previewUrlRef.current || previewBusyRef.current || startInFlight.current) return;
    void startPreview({ quiet: true });
  }, [startPreview]);

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
            { method: "POST", timeoutMs: 45_000 },
          );
          if (status.url) setPreviewUrl(status.runner_url || status.url);
          if (shouldRemount) remount();
        } catch (err) {
          // Fall back to a plain start if restart is unavailable.
          await startPreview({ quiet: opts?.quiet });
          if (shouldRemount) remount();
          if (!opts?.quiet) onError(err instanceof Error ? err.message : previewFailedLabel);
        }
      } else if (opts?.softStart) {
        try {
          const status = await api<PreviewStatusResponse>(`/projects/${projectId}/preview`);
          if (!status.running || !status.url) {
            await startPreview({ quiet: opts?.quiet });
          } else {
            setPreviewUrl(status.runner_url || status.url);
            if (shouldRemount) remount();
          }
        } catch {
          await startPreview({ quiet: opts?.quiet });
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

  /** Debounced SOFT refresh during agent runs: re-push the source bundle into
   *  the already-loaded runner (no server restart, no iframe reload — the old
   *  restart-per-burst made the screen flicker for the whole run). Falls back
   *  to a quiet start when the preview is not up yet. */
  const schedulePreviewRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      if (previewUrlRef.current) {
        setRenderNonce((n) => n + 1);
        // No flash during a run: the caller holds the badge on for the whole
        // run instead. Blinking it on and off once per task read as the page
        // reloading over and over, which is exactly what it was not doing.
        if (!holdUpdatingRef.current) flashUpdating();
      } else {
        void forcePreviewRefresh({ softStart: true, quiet: true });
      }
    }, 1200);
  }, [flashUpdating, forcePreviewRefresh]);

  /**
   * Hold the "updating" badge steady for the length of a run.
   *
   * Each `preview_refresh` used to light it for 1.2-1.6s, and a multi-task plan
   * sends one per task — so it strobed. One steady indicator says the same
   * thing and stops looking like a fault.
   */
  const setUpdatingHold = useCallback((held: boolean) => {
    holdUpdatingRef.current = held;
    if (updatingTimer.current) {
      clearTimeout(updatingTimer.current);
      updatingTimer.current = null;
    }
    setPreviewUpdating(held);
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
    ensurePreviewStarted,
    forcePreviewRefresh,
    schedulePreviewRefresh,
    flashUpdating,
    repushPreview,
    setUpdatingHold,
  };
}
