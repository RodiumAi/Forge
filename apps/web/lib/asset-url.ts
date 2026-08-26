import { apiBase, getToken } from "@/lib/api";

/** Durable authenticated URL for chat thumbs (<img src>). */
export function assetContentUrl(projectId: string, objectId: string): string | null {
  if (!projectId || !objectId) return null;
  const token = getToken();
  if (!token) return null;
  const base = apiBase().replace(/\/$/, "");
  return `${base}/projects/${projectId}/assets/${objectId}/content?access_token=${encodeURIComponent(token)}`;
}
