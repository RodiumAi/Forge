import { api, apiBase, getToken } from "@/lib/api";
import { getMediaToken } from "@/lib/media-token";

/** Build authenticated GET URL for a persisted project JPEG thumb. */
export function projectThumbnailUrl(
  projectId: string,
  updatedAt?: string | null,
): string | null {
  const token = getMediaToken();
  if (!token) return null;
  const v = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
  return `${apiBase()}/projects/${projectId}/thumbnail?access_token=${encodeURIComponent(token)}&v=${v}`;
}

/** Convert a JPEG data-URL to bytes and PUT `/projects/{id}/thumbnail`. */
export async function uploadProjectThumbnail(
  projectId: string,
  dataUrl: string,
): Promise<{ ok: boolean; updated_at?: string }> {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) return { ok: false };
  if (!getToken()) return { ok: false };

  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  try {
    const res = await api<{ ok?: boolean; updated_at?: string }>(
      `/projects/${projectId}/thumbnail`,
      {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: bytes,
        timeoutMs: 30_000,
        retries: 0,
      },
    );
    return { ok: true, updated_at: res?.updated_at };
  } catch {
    return { ok: false };
  }
}
