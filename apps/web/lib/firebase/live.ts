"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureFirebaseAuth, firebaseEnabled, getFirestoreDb } from "./client";

export type PreviewLive = {
  status: "stopped" | "starting" | "ready" | "dead" | "error" | string;
  port?: number | null;
  url?: string | null;
  public_url?: string | null;
  error?: string | null;
  updated_at?: string;
};

export type PublishLive = {
  phase: "idle" | "queued" | "deps" | "build" | "upload" | "done" | "error" | string;
  job_id?: string | null;
  message?: string | null;
  published_at?: string | null;
  updated_at?: string;
};

export type RunLive = {
  run_id?: string | null;
  status?: string;
  step_id?: string | null;
  step_label?: string | null;
  updated_at?: string;
};

export type FilesLive = {
  rev?: number;
  paths?: string[];
  updated_at?: string;
};

export type UserProjectLive = {
  name?: string;
  preview_status?: string;
  published_at?: string | null;
  active_run_status?: string | null;
  updated_at?: string;
};

function liveDoc(projectId: string, name: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, "forge_projects", projectId, "live", name);
}

async function withAuth(): Promise<boolean> {
  if (!firebaseEnabled()) return false;
  return ensureFirebaseAuth();
}

export function subscribePreview(
  projectId: string,
  onData: (data: PreviewLive | null) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let cancelled = false;
  void (async () => {
    if (!(await withAuth()) || cancelled) return;
    const ref = liveDoc(projectId, "preview");
    if (!ref) return;
    unsub = onSnapshot(
      ref,
      (snap) => onData(snap.exists() ? (snap.data() as PreviewLive) : null),
      () => onData(null),
    );
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribePublish(
  projectId: string,
  onData: (data: PublishLive | null) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let cancelled = false;
  void (async () => {
    if (!(await withAuth()) || cancelled) return;
    const ref = liveDoc(projectId, "publish");
    if (!ref) return;
    unsub = onSnapshot(
      ref,
      (snap) => onData(snap.exists() ? (snap.data() as PublishLive) : null),
      () => onData(null),
    );
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeRun(
  projectId: string,
  onData: (data: RunLive | null) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let cancelled = false;
  void (async () => {
    if (!(await withAuth()) || cancelled) return;
    const ref = liveDoc(projectId, "run");
    if (!ref) return;
    unsub = onSnapshot(
      ref,
      (snap) => onData(snap.exists() ? (snap.data() as RunLive) : null),
      () => onData(null),
    );
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeFiles(
  projectId: string,
  onData: (data: FilesLive | null) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let cancelled = false;
  void (async () => {
    if (!(await withAuth()) || cancelled) return;
    const ref = liveDoc(projectId, "files");
    if (!ref) return;
    unsub = onSnapshot(
      ref,
      (snap) => onData(snap.exists() ? (snap.data() as FilesLive) : null),
      () => onData(null),
    );
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function subscribeUserProjects(
  userId: string,
  onData: (rows: Record<string, UserProjectLive>) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let cancelled = false;
  void (async () => {
    if (!(await withAuth()) || cancelled) return;
    const db = getFirestoreDb();
    if (!db) return;
    const col = collection(db, "forge_users", userId, "projects");
    unsub = onSnapshot(
      col,
      (snap) => {
        const out: Record<string, UserProjectLive> = {};
        snap.forEach((d) => {
          out[d.id] = d.data() as UserProjectLive;
        });
        onData(out);
      },
      () => onData({}),
    );
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function usePreviewLive(projectId: string | null): PreviewLive | null {
  const [data, setData] = useState<PreviewLive | null>(null);
  useEffect(() => {
    if (!projectId) return;
    return subscribePreview(projectId, setData);
  }, [projectId]);
  return data;
}

export function usePublishLive(projectId: string | null): PublishLive | null {
  const [data, setData] = useState<PublishLive | null>(null);
  useEffect(() => {
    if (!projectId) return;
    return subscribePublish(projectId, setData);
  }, [projectId]);
  return data;
}

export function useRunLive(projectId: string | null): RunLive | null {
  const [data, setData] = useState<RunLive | null>(null);
  useEffect(() => {
    if (!projectId) return;
    return subscribeRun(projectId, setData);
  }, [projectId]);
  return data;
}

export function useFilesLive(projectId: string | null): FilesLive | null {
  const [data, setData] = useState<FilesLive | null>(null);
  useEffect(() => {
    if (!projectId) return;
    return subscribeFiles(projectId, setData);
  }, [projectId]);
  return data;
}
