/**
 * Ties an OAuth round-trip to the browser that started it.
 *
 * The `state` parameter is meant to prevent login CSRF: an attacker completing
 * the flow in your browser with *their* authorization code, silently signing
 * you into their account. Ours could not do that. It is a signed JWT carrying
 * the PKCE verifier, so it proves the server issued it — but nothing tied it to
 * a browser, and nothing marked it consumed, so anyone who obtained the string
 * could replay it for its full ten-minute life.
 *
 * The fix is one secret that never leaves this browser. We generate it here,
 * hand the server only its SHA-256, and present the original at the callback.
 * A state captured in transit is then worthless: whoever holds it cannot
 * produce the secret it was bound to.
 *
 * `sessionStorage`, not a cookie: the API is on a different origin and the
 * client sends no cookies, so a cookie-based binding would need CORS
 * credentials and `SameSite=None` — more moving parts for the same guarantee.
 * The trade-off is that the flow must finish in the tab that began it, which
 * is what a redirect does anyway.
 */

const STORAGE_KEY = "forge_oauth_state_binding";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Same guarantee for "Open Forge" from the RodiumAi dashboard (handoff). */
const HANDOFF_STORAGE_KEY = "forge_handoff_binding";

/**
 * Mint a binding secret, stash it, and return the hash to send to the server.
 */
export async function createStateBinding(): Promise<string> {
  return createBinding(STORAGE_KEY);
}

/** Read and burn the secret. Single-use: a replayed callback finds nothing. */
export function consumeStateBinding(): string | null {
  return consumeBinding(STORAGE_KEY);
}

/**
 * Handoff variant: the hash goes to the RodiumAi dashboard, which mints a
 * one-time code only this tab can redeem (it alone holds the secret).
 */
export async function createHandoffBinding(): Promise<string> {
  return createBinding(HANDOFF_STORAGE_KEY);
}

export function consumeHandoffBinding(): string | null {
  return consumeBinding(HANDOFF_STORAGE_KEY);
}

async function createBinding(storageKey: string): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // A one-time random nonce: only its hash leaves the tab, and it is burned
  // at the callback.
  const nonce = toHex(bytes.buffer);
  try {
    sessionStorage.setItem(storageKey, nonce);
  } catch {
    // Private mode with storage disabled: we cannot bind the flow to this
    // browser, and the server now refuses an unbound state (that opt-out was a
    // login-CSRF hole). Return empty so `/auth/rodium/start` fails cleanly and
    // the visitor falls back to password sign-in rather than an insecure flow.
    return "";
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce),
  );
  return toHex(digest);
}

function consumeBinding(storageKey: string): string | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    return value;
  } catch {
    return null;
  }
}
