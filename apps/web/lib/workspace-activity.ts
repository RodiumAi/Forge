"use client";

/**
 * What Forge is doing in the account right now (GET /workspace/activity): the
 * latest run state of every project (card badges) and the runs in progress
 * with their plan steps (the overview's resume card). One shared fetch, polled
 * while something is building. An API without the route answers 404: the
 * badges then fall back to draft / live.
 */

import { useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";

export type ActivityStep = { title: string; status: string };

export type ActiveRun = {
  project_id: string;
  project_name: string;
  platform: string;
  run_id: string;
  chat_id: string;
  status: string;
  steps: ActivityStep[];
  done: number;
  updated_at: string;
};

export type WorkspaceActivity = {
  states: Record<string, string>;
  active: ActiveRun[];
};

const EMPTY: WorkspaceActivity = { states: {}, active: [] };
const POLL_MS = 15_000;

let cache: WorkspaceActivity | null = null;
let flight: Promise<WorkspaceActivity> | null = null;
const listeners = new Set<(value: WorkspaceActivity) => void>();

export function refreshWorkspaceActivity(): Promise<WorkspaceActivity> {
  if (!getToken()) return Promise.resolve(EMPTY);
  if (flight) return flight;
  flight = api<WorkspaceActivity>("/workspace/activity", { retries: 0 })
    .then((body) => ({ states: body?.states ?? {}, active: Array.isArray(body?.active) ? body.active : [] }))
    .catch(() => cache ?? EMPTY)
    .then((value) => {
      cache = value;
      listeners.forEach((fn) => fn(value));
      return value;
    })
    .finally(() => {
      flight = null;
    });
  return flight;
}

export function useWorkspaceActivity(): WorkspaceActivity {
  const [value, setValue] = useState<WorkspaceActivity>(() => cache ?? EMPTY);
  useEffect(() => {
    listeners.add(setValue);
    void refreshWorkspaceActivity();
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  const building = value.active.length > 0;
  useEffect(() => {
    if (!building) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshWorkspaceActivity();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [building]);
  return value;
}
