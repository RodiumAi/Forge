/**
 * Calls of the design system editor and of the design system pickers.
 *
 * The document routes use ETags (optimistic concurrency), which `api()` does
 * not expose, so they go through `authFetch`; everything else uses `api()`.
 * Contract of the routes: `docs/plans/design-system-ai-events.md`.
 */

import { ApiError, api, apiBase, getToken, readApiError } from "@/lib/api";
import type { DesignSystemDoc } from "./tokens";

export type DesignSystemPreview = { colors: string[]; display: string | null; body: string | null };

export type DesignSystemItem = {
  id: string;
  name: string;
  scope: "personal" | "team" | "shared";
  visibility: "private" | "team";
  team_id: string | null;
  owner: { id: string; name: string | null; mine: boolean };
  is_default_user: boolean;
  is_default_team: boolean;
  can_edit: boolean;
  can_share: boolean;
  can_set_team_default: boolean;
  version: number;
  updated_at: string | null;
  preview: DesignSystemPreview;
};

export type DesignSystemList = {
  items: DesignSystemItem[];
  default_id: string | null;
  /** False below the Builder plan: shown locked, the API refuses to link one. Missing reads as allowed. */
  allowed?: boolean;
  required_plan?: string;
};

export type TokenChange = { name: string; from: string | null; to: string };
export type SyncChange = { path: string; action: "write"; tokens: TokenChange[] };

export type LinkStatus = {
  design_system: { id: string; name: string | null; version: number | null } | null;
  synced_version: number | null;
  outdated: boolean;
  available: boolean;
  changes: SyncChange[];
  written?: string[];
};

export type ExportFormat = "tokens" | "css" | "tailwind" | "md" | "pdf";

function localeHeader(): string {
  try {
    return localStorage.getItem("forge_locale") === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept-Language", localeHeader());
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

function etagOf(res: Response): string | null {
  return res.headers.get("ETag")?.replace(/"/g, "") ?? null;
}

export async function loadDocument(projectId: string): Promise<{ doc: DesignSystemDoc; etag: string | null }> {
  const res = await authFetch(`/projects/${projectId}/design-system`);
  if (!res.ok) throw await readApiError(res);
  return { doc: (await res.json()) as DesignSystemDoc, etag: etagOf(res) };
}

export async function saveDocument(
  projectId: string,
  doc: DesignSystemDoc,
  etag: string | null,
): Promise<{ doc: DesignSystemDoc; etag: string | null }> {
  const res = await authFetch(`/projects/${projectId}/design-system`, {
    method: "PUT",
    body: JSON.stringify(doc),
    headers: etag ? { "If-Match": `"${etag}"` } : undefined,
  });
  if (!res.ok) throw await readApiError(res);
  return { doc: (await res.json()) as DesignSystemDoc, etag: etagOf(res) };
}

export async function uploadLogo(projectId: string, file: File, variant: "light" | "dark" | "icon"): Promise<DesignSystemDoc> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`/projects/${projectId}/design-system/logo?variant=${variant}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as DesignSystemDoc;
}

/** A brand asset (the logo) as an object URL; the caller revokes it. */
export async function assetObjectUrl(projectId: string, path: string): Promise<string | null> {
  const res = await authFetch(`/projects/${projectId}/design-system/asset?path=${encodeURIComponent(path)}`);
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

export async function downloadExport(projectId: string, format: ExportFormat): Promise<void> {
  const res = await authFetch(`/projects/${projectId}/design-system/export/${format}`);
  if (!res.ok) throw await readApiError(res);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `design-system.${format}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── list, defaults, sharing ────────────────────────────────────────────────

export function listDesignSystems(): Promise<DesignSystemList> {
  return api<DesignSystemList>("/design-systems", { retries: 0 });
}

export function getDesignSystemItem(id: string): Promise<DesignSystemItem> {
  return api<DesignSystemItem>(`/design-systems/${id}`);
}

export function setDefault(id: string, scope: "user" | "team", value: boolean): Promise<DesignSystemItem> {
  return api<DesignSystemItem>(`/design-systems/${id}/default`, {
    method: "PUT",
    body: JSON.stringify({ scope, value }),
  });
}

export function share(id: string): Promise<DesignSystemItem> {
  return api<DesignSystemItem>(`/design-systems/${id}/share`, { method: "POST" });
}

export function unshare(id: string): Promise<DesignSystemItem> {
  return api<DesignSystemItem>(`/design-systems/${id}/share`, { method: "DELETE" });
}

export function publish(projectId: string): Promise<{ public_url: string }> {
  return api<{ public_url: string }>(`/projects/${projectId}/publish`, { method: "POST", body: "{}" });
}

// ── link from another project ──────────────────────────────────────────────

export function getLink(projectId: string): Promise<LinkStatus> {
  return api<LinkStatus>(`/projects/${projectId}/design-system-link`, { retries: 0 });
}

export function attach(projectId: string, designSystemId: string, apply = true): Promise<LinkStatus> {
  return api<LinkStatus>(`/projects/${projectId}/design-system-link`, {
    method: "PUT",
    body: JSON.stringify({ design_system_id: designSystemId, apply }),
  });
}

export function detach(projectId: string): Promise<LinkStatus> {
  return api<LinkStatus>(`/projects/${projectId}/design-system-link`, { method: "DELETE" });
}

export function resync(projectId: string, version: number): Promise<LinkStatus> {
  return api<LinkStatus>(`/projects/${projectId}/design-system-link/resync`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
