/**
 * Shared "Sign in / Connect with RodiumAi" OIDC kick-off.
 *
 * Used by login, settings Génération, and chat reconnect. Stashes an optional
 * post-callback path in sessionStorage so linking from Settings can land back
 * on `/settings?tab=generation` instead of always the dashboard.
 */

import { api, ApiError } from "@/lib/api";
import { createStateBinding } from "@/lib/oauth-state";

const RETURN_TO_KEY = "forge_oauth_return_to";

/** Only allow same-origin paths (open-redirect guard). */
function sanitizeReturnTo(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Preferred form: relative path.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  // Absolute same-origin (e.g. ChatErrorActions used to pass location.href) → path.
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(trimmed);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return null;
  }
}

export function stashOAuthReturnTo(returnTo?: string | null): void {
  const safe = sanitizeReturnTo(returnTo);
  try {
    if (safe) sessionStorage.setItem(RETURN_TO_KEY, safe);
    else sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // Private mode — callback falls back to /dashboard.
  }
}

/** Read and burn the return path. Single-use. */
export function consumeOAuthReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return sanitizeReturnTo(value);
  } catch {
    return null;
  }
}

export type StartRodiumOAuthResult =
  | { ok: true }
  | { ok: false; reason: "oidc_unavailable" | "error"; error?: unknown };

/**
 * Begin OIDC. On success the browser navigates away.
 * On 503 (no OIDC client), optionally redirects to settings; otherwise returns.
 */
export async function startRodiumOAuth(options?: {
  returnTo?: string | null;
  /**
   * Where to send the user when OIDC is not configured.
   * Omit for default `/settings?tab=generation`. Pass `null` to stay put.
   */
  unavailableHref?: string | null;
}): Promise<StartRodiumOAuthResult> {
  stashOAuthReturnTo(options?.returnTo);
  try {
    const binding = await createStateBinding();
    const data = await api<{ authorize_url: string }>(
      `/auth/rodium/start?state_binding=${encodeURIComponent(binding)}`,
    );
    window.location.href = data.authorize_url;
    return { ok: true };
  } catch (err) {
    try {
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {
      // ignore
    }
    if (err instanceof ApiError && err.status === 503) {
      const href =
        options && "unavailableHref" in options
          ? options.unavailableHref
          : "/settings?tab=generation";
      if (href) window.location.assign(href);
      return { ok: false, reason: "oidc_unavailable", error: err };
    }
    return { ok: false, reason: "error", error: err };
  }
}
