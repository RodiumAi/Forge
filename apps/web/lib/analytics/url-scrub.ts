/**
 * URLs sent to analytics must never carry secrets. Several pages receive
 * one-time tokens in the query string (email verification, password reset,
 * invitations) or in the fragment (`#code=` hand-off), and the page URL is
 * attached to every event by the analytics SDKs.
 *
 * The rule is an allowlist: the fragment is always dropped and only the query
 * parameters below survive.
 */

const ALLOWED_QUERY_KEYS = new Set(["ref", "plan", "tab"]);
const ALLOWED_QUERY_PREFIXES = ["utm_"];
const MAX_VALUE_LENGTH = 120;

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

function isAllowedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    ALLOWED_QUERY_KEYS.has(lower) ||
    ALLOWED_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

/** Returns the URL without its fragment and without non-allowlisted query parameters. */
export function scrubUrl(raw: string): string {
  if (!raw) return raw;
  const absolute = ABSOLUTE_URL.test(raw);
  let url: URL;
  try {
    url = new URL(raw, "http://scrub.invalid");
  } catch {
    // Not parseable as a URL: drop everything after the first "?" or "#".
    return raw.split(/[?#]/, 1)[0] ?? "";
  }

  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (isAllowedKey(key)) kept.append(key, value.slice(0, MAX_VALUE_LENGTH));
  });
  const search = kept.toString();
  const query = search ? `?${search}` : "";

  if (absolute) return `${url.origin}${url.pathname}${query}`;
  return `${url.pathname}${query}`;
}
