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
 */
export function buildPreviewSrc(
  previewUrl: string | null,
  key: number,
  apiBase: string,
): string | null {
  if (!previewUrl) return null;
  const absolute = previewUrl.startsWith("http")
    ? previewUrl
    : `${apiBase}${previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`}`;
  const join = absolute.includes("?") ? "&" : "?";
  return `${absolute}${join}t=${key}`;
}
