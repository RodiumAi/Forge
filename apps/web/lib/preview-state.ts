/**
 * Pure preview state helpers.
 *
 * The iframe URL and the Firestore status machine are the two places where
 * preview bugs actually live, so they are kept out of the hook and tested.
 */

export type PreviewLiveStatus = "starting" | "ready" | "dead" | "error" | "stopped" | string;

export type PreviewLiveEvent = {
  status?: PreviewLiveStatus;
  url?: string | null;
  error?: string | null;
};

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

export type PreviewLiveResult = {
  /** undefined = leave untouched. */
  url?: string | null;
  busy?: boolean;
  /** Bump the remount key. */
  remount?: boolean;
  /** Surface this error to the user. */
  error?: string;
};

/**
 * Translate a Firestore preview document into UI intent.
 *
 * `lastStatus` matters: the iframe is only remounted when the preview becomes
 * ready *again* after being down, not on every duplicate "ready" snapshot.
 */
export function reducePreviewLive(
  live: PreviewLiveEvent | null,
  lastStatus: string,
): PreviewLiveResult | null {
  if (!live?.status) return null;

  switch (live.status) {
    case "starting":
      return { busy: true };
    case "ready":
      return {
        url: live.url || undefined,
        busy: false,
        remount: Boolean(lastStatus) && lastStatus !== "ready",
      };
    case "dead":
      return { busy: false, url: null };
    case "error":
      return { busy: false, url: null, error: live.error || undefined };
    case "stopped":
      return { busy: false };
    default:
      return {};
  }
}
