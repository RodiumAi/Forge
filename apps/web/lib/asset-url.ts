import { apiBase } from "@/lib/api";
import { getMediaToken, primeMediaToken } from "@/lib/media-token";

/**
 * The read-only token these URLs carry. Null on the very first render if
 * nothing has primed it yet; the fetch it kicks off dispatches
 * `MEDIA_TOKEN_EVENT`, and callers re-render then.
 */
function mediaToken(): string | null {
  const token = getMediaToken();
  if (!token) void primeMediaToken();
  return token;
}

/** Private uploads bucket URLs (S3/MinIO) — never usable as <img src>. */
export function isPrivateUploadUrl(url: string | null | undefined): boolean {
  const value = (url || "").trim();
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  return (
    /localhost:9000\/forge-uploads\//i.test(value) ||
    /https?:\/\/(?:forge-uploads(?:-prod)?|rodiumai-forge-uploads-prod)\./i.test(value) ||
    /\/forge-uploads(?:-prod)?\//i.test(value) ||
    /\/rodiumai-forge-uploads-prod\//i.test(value)
  );
}

/** Durable authenticated URL for chat thumbs (<img src>). */
export function assetContentUrl(projectId: string, objectId: string): string | null {
  if (!projectId || !objectId) return null;
  const token = mediaToken();
  if (!token) return null;
  const base = apiBase().replace(/\/$/, "");
  return `${base}/projects/${projectId}/assets/${objectId}/content?access_token=${encodeURIComponent(token)}`;
}

/**
 * Authenticated URL for a file in the project's `public/` folder.
 *
 * These were served through the Vite preview proxy (`/preview/{id}/<file>`);
 * that proxy no longer exists, so favicon and SEO previews resolved to 404 and
 * rendered as broken images.
 */
export function projectPublicUrl(
  projectId: string,
  path: string | null | undefined,
  bust: number | string = "",
): string | null {
  if (!projectId || !path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const token = mediaToken();
  if (!token) return null;
  const rel = path.replace(/^public\//i, "").replace(/^\//, "");
  if (!rel) return null;
  const base = apiBase().replace(/\/$/, "");
  const version = bust === "" ? "" : `&v=${encodeURIComponent(String(bust))}`;
  return `${base}/projects/${projectId}/public/${rel}?access_token=${encodeURIComponent(token)}${version}`;
}
