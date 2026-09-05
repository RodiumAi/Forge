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

/**
 * Mint a binding secret, stash it, and return the hash to send to the server.
 */
export async function createStateBinding(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = toHex(bytes.buffer);
  try {
    sessionStorage.setItem(STORAGE_KEY, secret);
  } catch {
    // Private mode with storage disabled: the server treats a state with no
    // binding as unbound and the flow still works, just without this guard.
    return "";
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return toHex(digest);
}

/** Read and burn the secret. Single-use: a replayed callback finds nothing. */
export function consumeStateBinding(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
