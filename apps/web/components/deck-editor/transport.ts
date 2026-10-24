/**
 * HTTP access to the deck documents (`apps/api/app/routers/documents.py`):
 * GET returns the content and its ETag, PUT sends `If-Match` and gets 409
 * when the file changed meanwhile.
 */

import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { apiBase, getToken, logoutToHome, readApiError } from "@/lib/api";
import { ConflictError, type DocTransport, type Versioned } from "./autosave";

function headers(etag?: string | null, json = false): Headers {
  const h = new Headers();
  const token = getToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (json) h.set("Content-Type", "application/json");
  if (etag) h.set("If-Match", `"${etag.replace(/^W\//, "").replace(/"/g, "")}"`);
  try {
    h.set("Accept-Language", localStorage.getItem("forge_locale") === "en" ? "en" : "fr");
  } catch {
    h.set("Accept-Language", "fr");
  }
  return h;
}

function etagOf(res: Response): string | null {
  const raw = res.headers.get("ETag");
  return raw ? raw.replace(/^W\//, "").replace(/"/g, "") : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Versioned<T>> {
  const res = await fetch(`${apiBase()}${path}`, { cache: "no-store", ...init });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    if (res.status === 401) logoutToHome("expired");
    throw await readApiError(res);
  }
  return { value: (await res.json()) as T, etag: etagOf(res) };
}

export function documentTransport(projectId: string): DocTransport {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return {
    getDeck: () => request<Deck>(`${base}/deck`, { headers: headers() }),
    putDeck: (deck, etag) => request<Deck>(`${base}/deck`, { method: "PUT", headers: headers(etag, true), body: JSON.stringify(deck) }),
    getSlide: (id) => request<Slide>(`${base}/slides/${encodeURIComponent(id)}`, { headers: headers() }),
    putSlide: (id, slide, etag) =>
      request<Slide>(`${base}/slides/${encodeURIComponent(id)}`, { method: "PUT", headers: headers(etag, true), body: JSON.stringify(slide) }),
    getNotes: async (id) => {
      const res = await request<{ markdown: string }>(`${base}/notes/${encodeURIComponent(id)}`, { headers: headers() });
      return { value: res.value.markdown ?? "", etag: res.etag };
    },
    putNotes: async (id, markdown, etag) => {
      const res = await request<{ markdown: string }>(`${base}/notes/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: headers(etag, true),
        body: JSON.stringify({ markdown }),
      });
      return { value: res.value.markdown ?? "", etag: res.etag };
    },
  };
}

/** Text of a project file (the theme's DESIGN.md), or null when absent. */
export async function readProjectFile(projectId: string, path: string): Promise<string | null> {
  const res = await fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/files/content?path=${encodeURIComponent(path)}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string };
  return typeof data.content === "string" ? data.content : null;
}
