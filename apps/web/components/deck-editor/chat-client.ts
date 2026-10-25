/**
 * The project chat over HTTP for the deck editor: history, the active run
 * (an outline waiting for confirmation survives a refresh), sending a
 * message and confirming an outline, both streamed as server-sent events.
 */

import { api, apiBase, getToken, logoutToHome, readApiError } from "@/lib/api";
import { readSseStream } from "@/lib/sse";
import type { MessageBody, OutlineTask } from "./ai";

/** `tag` is the target label ("Slide 6") shown on a message sent from this tab. */
export type ChatMessage = { id: string; role: string; content: string; tag?: string };
export type ActiveRun = {
  id: string;
  status: string;
  plan: Record<string, unknown>[];
  plan_meta?: { title?: string; summary?: string } | null;
};

export type StreamHandler = (payload: Record<string, unknown>) => void;

export type ChatClient = {
  messages(): Promise<ChatMessage[]>;
  active(): Promise<ActiveRun | null>;
  send(body: MessageBody, onEvent: StreamHandler, signal: AbortSignal): Promise<void>;
  confirm(runId: string, plan: { plan: OutlineTask[] }, onEvent: StreamHandler, signal: AbortSignal): Promise<void>;
  subscribe(runId: string, onEvent: StreamHandler, signal: AbortSignal): Promise<void>;
  cancel(runId: string): Promise<void>;
};

function locale(): string {
  try {
    return localStorage.getItem("forge_locale") === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

async function stream(url: string, init: RequestInit, onEvent: StreamHandler): Promise<void> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getToken() ?? ""}`);
  headers.set("Accept-Language", locale());
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (!res.ok || !res.body) {
    if (res.status === 401) logoutToHome("expired");
    throw await readApiError(res);
  }
  await readSseStream(res, (payload) => onEvent(payload));
}

export function apiChatClient(projectId: string): ChatClient {
  const project = `/projects/${encodeURIComponent(projectId)}`;
  let chatId: string | null = null;
  const chat = async (): Promise<string> => {
    if (chatId) return chatId;
    const chats = await api<{ id: string }[]>(`${project}/chats`);
    chatId = chats[0]?.id ?? (await api<{ id: string }>(`${project}/chats`, { method: "POST", body: JSON.stringify({}) })).id;
    return chatId;
  };
  const base = async () => `${apiBase()}${project}/chats/${await chat()}`;
  return {
    messages: async () => {
      const rows = await api<ChatMessage[]>(`${project}/chats/${await chat()}/messages`);
      return rows.map((m) => ({ id: String(m.id), role: m.role, content: m.content }));
    },
    active: async () => {
      try {
        return await api<ActiveRun | null>(`${project}/chats/${await chat()}/runs/active`);
      } catch {
        return null;
      }
    },
    send: async (body, onEvent, signal) => stream(`${await base()}/messages`, { method: "POST", body: JSON.stringify(body), signal }, onEvent),
    confirm: async (runId, plan, onEvent, signal) =>
      stream(`${await base()}/runs/${encodeURIComponent(runId)}/confirm-plan`, { method: "POST", body: JSON.stringify(plan), signal }, onEvent),
    subscribe: async (runId, onEvent, signal) => stream(`${await base()}/runs/${encodeURIComponent(runId)}/events?after=0`, { signal }, onEvent),
    cancel: async (runId) => {
      await api(`${project}/chats/${await chat()}/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
    },
  };
}
