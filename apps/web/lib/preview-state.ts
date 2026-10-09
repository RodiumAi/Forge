/**
 * Pure preview state helpers.
 *
 * The iframe URL is where preview bugs actually live, so it is kept out of
 * the hook and tested.
 */

/**
 * Absolute, cache-busted URL for the runner iframe.
 *
 * `key` changes force a remount; the API may hand back either an absolute
 * runner URL or a path relative to the API origin.
 *
 * When the API returns an absolute URL whose host differs from `apiBase`
 * (e.g. `localhost` vs `127.0.0.1` on Windows), rewrite to `apiBase` so the
 * iframe matches CSP `frame-src` and the same stack the client already uses
 * for fetch.
 */
export function buildPreviewSrc(
  previewUrl: string | null,
  key: number,
  apiBase: string,
): string | null {
  if (!previewUrl) return null;
  let absolute: string;
  if (previewUrl.startsWith("http")) {
    absolute = alignPreviewOrigin(previewUrl, apiBase) ?? previewUrl;
  } else {
    absolute = `${apiBase}${previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`}`;
  }
  const join = absolute.includes("?") ? "&" : "?";
  return `${absolute}${join}t=${key}`;
}

/** Same-path rewrite when hosts differ but both are loopback (or apiBase wins). */
export function alignPreviewOrigin(previewUrl: string, apiBase: string): string | null {
  let api: URL;
  let preview: URL;
  try {
    api = new URL(apiBase);
    preview = new URL(previewUrl);
  } catch {
    return null;
  }
  if (preview.origin === api.origin) return preview.toString();
  // Always prefer the client-configured API origin for same-path runner URLs.
  if (
    preview.pathname === api.pathname ||
    preview.pathname.startsWith("/runner") ||
    preview.pathname.startsWith("/preview") ||
    preview.pathname.startsWith("/projects/")
  ) {
    return `${api.origin}${preview.pathname}${preview.search}${preview.hash}`;
  }
  return null;
}
