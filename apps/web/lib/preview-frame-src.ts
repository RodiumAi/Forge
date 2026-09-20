/** Allowlist draft/preview URLs for the device-frame new-tab page. */

export function sanitizePreviewFrameSrc(
  raw: string | null,
  apiBaseUrl: string,
): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  let apiHost: string;
  try {
    apiHost = new URL(apiBaseUrl).host;
  } catch {
    return null;
  }
  if (url.host !== apiHost) return null;
  if (
    !/^\/projects\/[0-9a-f-]{36}\/draft\/?$/i.test(url.pathname) &&
    !/^\/preview\/[0-9a-f-]{36}\/?$/i.test(url.pathname)
  ) {
    return null;
  }
  return url.toString();
}
