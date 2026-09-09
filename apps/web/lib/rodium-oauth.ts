/**
 * Shared "Sign in / Connect with RodiumAi" OIDC kick-off.
 *
 * Used by login, settings Génération, and chat reconnect. Stashes an optional
 * post-callback path in sessionStorage so linking from Settings can land back
 * on `/settings?tab=generation` instead of always the dashboard.
 *
 * Default mode is a centered popup (Firebase-style). The OIDC round-trip must
 * start *inside* that popup so the sessionStorage state binding stays valid.
 * `mode: "redirect"` keeps the full-page flow for `?autostart=1`.
 */

import { api, ApiError, getToken } from "@/lib/api";
import { createStateBinding } from "@/lib/oauth-state";

const RETURN_TO_KEY = "forge_oauth_return_to";

/** sessionStorage flag set by the popup before redirecting to RodiumAi. */
export const OAUTH_POPUP_FLAG_KEY = "forge_oauth_popup";

/** `window.name` of the OAuth popup — also used by the callback to detect mode. */
export const OAUTH_POPUP_WINDOW_NAME = "forge-rodium-oauth";

/** postMessage type from popup → opener after a successful token exchange. */
export const OAUTH_POPUP_MESSAGE_TYPE = "forge-rodium-oauth";

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 680;

/** Only allow same-origin paths (open-redirect guard). */
export function sanitizeReturnTo(value: string | undefined | null): string | null {
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

export function isOAuthPopupWindow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(OAUTH_POPUP_FLAG_KEY) === "1") return true;
  } catch {
    // ignore
  }
  return window.name === OAUTH_POPUP_WINDOW_NAME;
}

export function clearOAuthPopupFlag(): void {
  try {
    sessionStorage.removeItem(OAUTH_POPUP_FLAG_KEY);
  } catch {
    // ignore
  }
}

/** Notify the opener and close — used by `/auth/callback` after setToken. */
export function finishOAuthPopup(): void {
  clearOAuthPopupFlag();
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: OAUTH_POPUP_MESSAGE_TYPE, ok: true },
        window.location.origin,
      );
    }
  } catch {
    // COOP may null opener; localStorage token + storage event still wake the opener.
  }
  window.close();
}

function popupFeatures(): string {
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
  const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
  const left = Math.max(0, Math.round(dualScreenLeft + (width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round(dualScreenTop + (height - POPUP_HEIGHT) / 2));
  return [
    `width=${POPUP_WIDTH}`,
    `height=${POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

export type StartRodiumOAuthResult =
  | { ok: true; mode: "popup" | "redirect" }
  | {
      ok: false;
      reason: "oidc_unavailable" | "popup_blocked" | "cancelled" | "error";
      error?: unknown;
    };

async function startRodiumOAuthRedirect(options?: {
  unavailableHref?: string | null;
}): Promise<StartRodiumOAuthResult> {
  try {
    const binding = await createStateBinding();
    const data = await api<{ authorize_url: string }>(
      `/auth/rodium/start?state_binding=${encodeURIComponent(binding)}`,
    );
    window.location.href = data.authorize_url;
    return { ok: true, mode: "redirect" };
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

function waitForPopupCompletion(popup: Window): Promise<StartRodiumOAuthResult> {
  const hadToken = Boolean(getToken());

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: StartRodiumOAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(pollId);
      resolve(result);
    };

    const onSuccess = () => {
      const dest = consumeOAuthReturnTo() || "/dashboard";
      finish({ ok: true, mode: "popup" });
      window.location.assign(dest);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; ok?: boolean } | null;
      if (data?.type !== OAUTH_POPUP_MESSAGE_TYPE) return;
      if (data.ok) onSuccess();
      else finish({ ok: false, reason: "error" });
    };

    const onStorage = (event: StorageEvent) => {
      // setToken writes forge_token in the popup; this fires in the opener only.
      if (event.key !== "forge_token" || !event.newValue) return;
      onSuccess();
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);

    const pollId = window.setInterval(() => {
      if (!popup.closed) return;
      // Token written in the popup before close — storage event can race closed.
      if (!hadToken && getToken()) {
        onSuccess();
        return;
      }
      finish({ ok: false, reason: "cancelled" });
    }, 400);
  });
}

/**
 * Begin OIDC.
 *
 * - `popup` (default): opens `/auth/rodium-popup`, waits for token, then lands
 *   on the stashed return path (or `/dashboard`).
 * - `redirect`: full-page navigation (autostart from the RodiumAi dashboard).
 *
 * On 503 (no OIDC client), optionally redirects to settings; otherwise returns.
 */
export async function startRodiumOAuth(options?: {
  returnTo?: string | null;
  /**
   * Where to send the user when OIDC is not configured.
   * Omit for default `/settings?tab=generation`. Pass `null` to stay put.
   */
  unavailableHref?: string | null;
  /** Default `popup`. Use `redirect` for `?autostart=1`. */
  mode?: "popup" | "redirect";
}): Promise<StartRodiumOAuthResult> {
  stashOAuthReturnTo(options?.returnTo);
  const mode = options?.mode ?? "popup";

  if (mode === "redirect") {
    return startRodiumOAuthRedirect(options);
  }

  const popup = window.open(
    "/auth/rodium-popup",
    OAUTH_POPUP_WINDOW_NAME,
    popupFeatures(),
  );
  if (!popup) {
    try {
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {
      // ignore
    }
    return { ok: false, reason: "popup_blocked" };
  }

  try {
    popup.focus();
  } catch {
    // ignore
  }

  return waitForPopupCompletion(popup);
}

/**
 * Kick off OIDC *inside* the popup window (create binding → authorize URL).
 * Called only from `/auth/rodium-popup`.
 */
export async function beginRodiumOAuthInPopup(): Promise<
  { ok: true } | { ok: false; reason: "oidc_unavailable" | "error"; error?: unknown }
> {
  try {
    sessionStorage.setItem(OAUTH_POPUP_FLAG_KEY, "1");
  } catch {
    // Binding may still work; popup detection falls back to window.name.
  }
  try {
    const binding = await createStateBinding();
    const data = await api<{ authorize_url: string }>(
      `/auth/rodium/start?state_binding=${encodeURIComponent(binding)}`,
    );
    window.location.href = data.authorize_url;
    return { ok: true };
  } catch (err) {
    clearOAuthPopupFlag();
    if (err instanceof ApiError && err.status === 503) {
      return { ok: false, reason: "oidc_unavailable", error: err };
    }
    return { ok: false, reason: "error", error: err };
  }
}
