"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiBase } from "@/lib/api";
import { firebaseEnabled } from "@/lib/firebase/client";
import { subscribePreview, type PreviewLive } from "@/lib/firebase/live";
import { buildPreviewSrc, reducePreviewLive } from "@/lib/preview-state";
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

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (updatingTimer.current) clearTimeout(updatingTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (previewBusy || previewUpdating) topProgressStart("preview");
    else topProgressDone("preview");
  }, [previewBusy, previewUpdating]);

  // Start the preview once, after the project is loaded.
  useEffect(() => {
    if (loading || previewUrl || previewBusy || autoStarted.current) return;
    autoStarted.current = true;
    void startPreview();
  }, [loading, previewBusy, previewUrl, startPreview]);

  // Firestore live status is the primary signal when the emulator/prod is on.
  useEffect(() => {
    if (!projectId || !firebaseEnabled()) return;
    let lastStatus = "";
    return subscribePreview(projectId, (live: PreviewLive | null) => {
      const result = reducePreviewLive(live, lastStatus);
      if (!result) return;
      lastStatus = String(live?.status || lastStatus);

      setPreviewLiveStatus(String(live?.status || ""));
      if (result.url !== undefined) setPreviewUrl(result.url);
      if (result.busy !== undefined) setPreviewBusy(result.busy);
      if (result.remount) remount();
      if (result.error) onError(result.error);
    });
  }, [onError, projectId, remount]);

  return {
    previewUrl,
    setPreviewUrl,
    previewSrc,
    previewKey,
    previewBusy,
    previewUpdating,
    previewLiveStatus,
    startPreview,
    forcePreviewRefresh,
    schedulePreviewRefresh,
    flashUpdating,
  };
}
