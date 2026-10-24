/**
 * Codelab routes with ETag / If-Match (the shared `api()` helper hides
 * headers), file uploads and authenticated downloads.
 */

import { apiBase, ApiError, getToken, readApiError } from "@/lib/api";
import { codelabSchema, type Codelab } from "@/lib/contracts/forge-design";
import { apiChatClient, type ChatClient } from "../deck-editor/chat-client";
import type { MessageBody, OutlineTask } from "../deck-editor/ai";
import type { CodelabMessageBody } from "./ai";

export type Versioned<T> = { data: T; etag: string | null };
export type StepDoc = { id: string; file: string; markdown: string };
export type CodelabFile = { path: string; size: number };

function headers(extra?: Record<string, string>): Headers {
  const h = new Headers(extra);
  const token = getToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (typeof window !== "undefined") h.set("Accept-Language", localStorage.getItem("forge_locale") === "en" ? "en" : "fr");
  return h;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers: headers(init.headers as Record<string, string>) });
  if (!res.ok) throw await readApiError(res);
  return res;
}

export async function getCodelab(projectId: string): Promise<Versioned<Codelab>> {
  const res = await request(`/projects/${projectId}/codelab`);
  return { data: codelabSchema.parse(await res.json()), etag: res.headers.get("ETag") };
}

export async function putCodelab(projectId: string, codelab: Codelab, etag: string | null): Promise<Versioned<Codelab>> {
  const res = await request(`/projects/${projectId}/codelab`, {
    method: "PUT",
    body: JSON.stringify(codelab),
    headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
  });
  return { data: codelabSchema.parse(await res.json()), etag: res.headers.get("ETag") };
}

export async function getStep(projectId: string, stepId: string): Promise<Versioned<StepDoc>> {
  const res = await request(`/projects/${projectId}/steps/${encodeURIComponent(stepId)}`);
  return { data: (await res.json()) as StepDoc, etag: res.headers.get("ETag") };
}

export async function putStep(projectId: string, stepId: string, markdown: string, etag: string | null): Promise<Versioned<StepDoc>> {
  const res = await request(`/projects/${projectId}/steps/${encodeURIComponent(stepId)}`, {
    method: "PUT",
    body: JSON.stringify({ markdown }),
    headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
  });
  return { data: (await res.json()) as StepDoc, etag: res.headers.get("ETag") };
}

export async function getDesign(projectId: string): Promise<string> {
  try {
    const res = await request(`/projects/${projectId}/files/content?path=DESIGN.md`);
    const body = (await res.json()) as { content?: string };
    return body.content ?? "";
  } catch {
    return "";
  }
}

export async function listFiles(projectId: string): Promise<CodelabFile[]> {
  const res = await request(`/projects/${projectId}/codelab/files`);
  return ((await res.json()) as { files: CodelabFile[] }).files;
}

export async function uploadFile(projectId: string, file: File, folder: string): Promise<CodelabFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await request(`/projects/${projectId}/codelab/files`, { method: "POST", body: form });
  return (await res.json()) as CodelabFile;
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  await request(`/projects/${projectId}/codelab/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
}

export async function importClaat(projectId: string, markdown: string): Promise<{ codelab: Codelab; warnings: string[] }> {
  const res = await request(`/projects/${projectId}/codelab/import/claat`, {
    method: "POST",
    body: JSON.stringify({ markdown }),
    headers: { "Content-Type": "application/json" },
  });
  const body = (await res.json()) as { codelab: unknown; warnings: string[] };
  return { codelab: codelabSchema.parse(body.codelab), warnings: body.warnings ?? [] };
}

export async function getSettings(projectId: string): Promise<{ feedbackUrl?: string }> {
  const res = await request(`/projects/${projectId}/codelab/settings`);
  return (await res.json()) as { feedbackUrl?: string };
}

export async function putSettings(projectId: string, settings: { feedbackUrl?: string }): Promise<{ feedbackUrl?: string }> {
  const res = await request(`/projects/${projectId}/codelab/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
    headers: { "Content-Type": "application/json" },
  });
  return (await res.json()) as { feedbackUrl?: string };
}

/** Download an authenticated file (export or project file) through a Blob. */
export async function downloadFrom(path: string, fallbackName: string): Promise<void> {
  const res = await request(path);
  const disposition = res.headers.get("Content-Disposition") || "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** The project chat (deck editor client) typed for codelab requests. */
export type CodelabChatClient = {
  messages(): Promise<{ id: string; role: string; content: string }[]>;
  active(): Promise<{ id: string; status: string; plan: Record<string, unknown>[]; plan_meta?: { title?: string; summary?: string } | null } | null>;
  send(body: CodelabMessageBody, onEvent: (payload: Record<string, unknown>) => void, signal: AbortSignal): Promise<void>;
  confirm(runId: string, body: { plan: Record<string, unknown>[] }, onEvent: (payload: Record<string, unknown>) => void, signal: AbortSignal): Promise<void>;
  subscribe(runId: string, onEvent: (payload: Record<string, unknown>) => void, signal: AbortSignal): Promise<void>;
  cancel(runId: string): Promise<void>;
};

export function codelabChatClient(projectId: string): CodelabChatClient {
  const chat: ChatClient = apiChatClient(projectId);
  return {
    messages: () => chat.messages(),
    active: () => chat.active(),
    send: (body, onEvent, signal) => chat.send(body as unknown as MessageBody, onEvent, signal),
    confirm: (runId, body, onEvent, signal) => chat.confirm(runId, body as unknown as { plan: OutlineTask[] }, onEvent, signal),
    subscribe: (runId, onEvent, signal) => chat.subscribe(runId, onEvent, signal),
    cancel: (runId) => chat.cancel(runId),
  };
}
