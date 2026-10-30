/**
 * Share a project by link (Canva style). The owner picks who the link is for:
 * nobody, anyone in presentation mode (no account), or Forge accounts that
 * join as editors while the plan has a free seat. The token is the secret;
 * resetting it cuts every link already sent.
 */

import { api, apiBase } from "@/lib/api";
import type { Deck, Slide } from "@/lib/contracts/forge-design";

export type LinkAccess = "none" | "view" | "edit";

export type ShareLink = {
  access: LinkAccess;
  token: string | null;
  /** Seats left for people joining by an edit link; null means unlimited. */
  seats_left: number | null;
  /** False when the plan has no sharing: only "none" and "view" are open. */
  can_edit_link: boolean;
};

export type ShareLinkClient = {
  get: () => Promise<ShareLink>;
  set: (access: LinkAccess) => Promise<ShareLink>;
  reset: () => Promise<ShareLink>;
  url: (token: string) => string;
};

export function shareLinkUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${encodeURIComponent(token)}`;
}

export function apiShareLinkClient(projectId: string): ShareLinkClient {
  const base = `/projects/${encodeURIComponent(projectId)}/link`;
  return {
    get: () => api<ShareLink>(base),
    set: (access) => api<ShareLink>(base, { method: "PUT", body: JSON.stringify({ access }) }),
    reset: () => api<ShareLink>(`${base}/reset`, { method: "POST" }),
    url: shareLinkUrl,
  };
}

// ── Public side ─────────────────────────────────────────────────────────────

export type SharedInfo = { project_id: string; name: string; kind: string; access: LinkAccess };

export type SharedPresentation = {
  name: string;
  deck: Deck;
  slides: Record<string, Slide>;
  theme: string;
};

export type JoinResult = {
  project_id: string;
  /** owner / editor / viewer open the editor; "view" stays on the viewer page. */
  role: "owner" | "editor" | "viewer" | "view";
  reason?: "no_seat" | null;
};

const tokenPath = (token: string) => `/share/${encodeURIComponent(token)}`;

export const fetchShared = (token: string) => api<SharedInfo>(tokenPath(token));

export const fetchSharedPresentation = (token: string) => api<SharedPresentation>(`${tokenPath(token)}/presentation`);

export const joinShared = (token: string) => api<JoinResult>(`${tokenPath(token)}/join`, { method: "POST" });

export function sharedAssetUrl(token: string, path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = path.replace(/^\/+/, "").replace(/^public\//, "");
  return `${apiBase()}${tokenPath(token)}/asset/${clean.split("/").map(encodeURIComponent).join("/")}`;
}
