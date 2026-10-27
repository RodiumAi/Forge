/**
 * "Open Forge" from the RodiumAi dashboard without a second sign-in.
 *
 * Two legs, both on `/auth/handoff`:
 *
 * 1. Start (no fragment): generate a tab secret, keep it in sessionStorage
 *    and send only its SHA-256 to `rodiumai.io/forge/handoff`. The dashboard
 *    uses its own session to mint a one-time code for that hash.
 * 2. Finish (`#code=…`): the dashboard sent us back with the code in the
 *    fragment (never logged, never in a Referer). We strip it from the URL,
 *    then the API redeems code + tab secret server-side for a Forge session.
 *
 * Because the code only works with the secret this tab holds, a forwarded or
 * leaked link cannot sign another browser into someone else's account.
 */

import { api, setToken } from "@/lib/api";
import { rodiumUserAppOrigin } from "@/lib/constants/rodium-links";
import { consumeHandoffBinding, createHandoffBinding } from "@/lib/oauth-state";
import { sanitizeReturnTo } from "@/lib/rodium-oauth";

export const HANDOFF_PATH = "/auth/handoff";

export type HandoffFragment = { code: string | null; next: string | null };

/** Read `#code=…&next=…` left by the dashboard. */
export function parseHandoffFragment(hash: string): HandoffFragment {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const code = params.get("code")?.trim() || null;
  return { code, next: params.get("next") };
}

/** Where the start leg sends the tab: the dashboard's minting page. */
export function dashboardHandoffUrl(binding: string, next: string | null): string {
  const url = new URL(`${rodiumUserAppOrigin()}/forge/handoff`);
  url.searchParams.set("binding", binding);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

/** Regular OIDC autostart — the fallback whenever the handoff cannot run. */
export function autostartLoginPath(next: string | null): string {
  const qs = new URLSearchParams({ autostart: "1" });
  if (next) qs.set("next", next);
  return `/login?${qs}`;
}

export type StartHandoffResult = { kind: "redirect"; url: string };

/**
 * Leg 1. Returns where to navigate: the dashboard minting page, or the OIDC
 * autostart when the API has no handoff (open-source clone, no secret) or the
 * browser cannot keep the tab secret.
 */
export async function startRodiumHandoff(rawNext: string | null): Promise<StartHandoffResult> {
  const next = sanitizeReturnTo(rawNext);
  let available = false;
  try {
    const features = await api<{ rodium_handoff?: boolean }>("/auth/features");
    available = Boolean(features.rodium_handoff);
  } catch {
    available = false;
  }
  if (!available) return { kind: "redirect", url: autostartLoginPath(next) };

  const binding = await createHandoffBinding();
  if (!binding) return { kind: "redirect", url: autostartLoginPath(next) };
  return { kind: "redirect", url: dashboardHandoffUrl(binding, next) };
}

/**
 * Two finishes for the same `#code` in flight at once share one redeem (the
 * second would find the tab secret already burnt). Entries are dropped as soon
 * as they settle: a later call must go through the secret check again.
 */
const inflightFinishes = new Map<string, Promise<string>>();

/**
 * Leg 2. Redeems the code with this tab's secret and stores the Forge
 * session. Returns the in-app path to land on. Throws when the code is
 * expired, already used, or was opened in a tab that did not request it.
 */
export async function finishRodiumHandoff(fragment: HandoffFragment): Promise<string> {
  if (!fragment.code) {
    throw new HandoffMismatchError();
  }
  const key = fragment.code;
  const existing = inflightFinishes.get(key);
  if (existing) return existing;

  let resolve!: (value: string) => void;
  let reject!: (reason?: unknown) => void;
  const placeholder = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  inflightFinishes.set(key, placeholder);

  const binding = consumeHandoffBinding();
  if (!binding) {
    inflightFinishes.delete(key);
    reject(new HandoffMismatchError());
    return placeholder;
  }

  void (async () => {
    try {
      // The dashboard just told us who is signed in on RodiumAi; whatever Forge
      // session this browser held before belongs to the previous account.
      setToken(null);
      const { clearSessionCache, prepareSessionAfterRodiumLogin } = await import(
        "@/lib/session-cache"
      );
      clearSessionCache();
      const data = await api<{ access_token: string }>("/auth/rodium/handoff", {
        method: "POST",
        body: JSON.stringify({ code: fragment.code, binding }),
      });
      setToken(data.access_token);
      try {
        await prepareSessionAfterRodiumLogin();
      } catch {
        // Best-effort hydrate; the dashboard refreshes again.
      }
      resolve(sanitizeReturnTo(fragment.next) || "/dashboard");
    } catch (err) {
      reject(err);
    } finally {
      inflightFinishes.delete(key);
    }
  })();

  return placeholder;
}

/** The code reached a tab that never asked for it (forwarded link, new tab). */
export class HandoffMismatchError extends Error {
  constructor() {
    super("handoff_binding_missing");
    this.name = "HandoffMismatchError";
  }
}
