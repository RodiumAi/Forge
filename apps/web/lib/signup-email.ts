/**
 * Addresses that may never be used to create a new Forge account.
 *
 * Client-side twin of `app/services/signup_email.py` (Forge API) and of
 * `src/common/validation/signup-email.ts` (RodiumAi Nest backend). The server
 * stays the source of truth; keep the rules and the test table identical.
 *
 * Used on sign-up only, never on sign-in.
 */

export const INVALID_EMAIL_ADDRESS_CODE = "invalid_email_address";

/** Domain labels reserved for documentation and testing (RFC 2606 / 6761). */
const RESERVED_LABELS = new Set(["example", "test", "invalid", "localhost"]);
/** Top-level domains that never route real mail. */
const RESERVED_TLDS = new Set([
  "test",
  "example",
  "invalid",
  "localhost",
  "local",
]);
/** Whole local parts that are placeholders, optionally followed by digits. */
const PLACEHOLDER_LOCAL =
  /^(test|testing|tester|tests|example|exemple|demo|fake|dummy|sample|foo|bar|foobar|baz|asdf|qwerty|azerty|abc|xxx|aaa|noreply|no-reply|nobody|null|undefined)[._-]?\d*$/;

/**
 * Returns `"invalid_email_address"` when `email` may not open a new account,
 * `null` when it may.
 */
export function signupEmailProblem(email: string): string | null {
  const normalized = (email ?? "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return INVALID_EMAIL_ADDRESS_CODE;
  }

  // 1. Our own name, anywhere in the address.
  if (normalized.includes("rodiumai")) return INVALID_EMAIL_ADDRESS_CODE;

  // 2. Reserved domains and TLDs.
  const domain = normalized.slice(at + 1);
  const labels = domain.split(".");
  if (labels.some((label) => RESERVED_LABELS.has(label))) {
    return INVALID_EMAIL_ADDRESS_CODE;
  }
  if (RESERVED_TLDS.has(labels[labels.length - 1])) {
    return INVALID_EMAIL_ADDRESS_CODE;
  }

  // 3. Placeholder local part (a `+tag` suffix is ignored).
  const local = normalized.slice(0, at).split("+")[0];
  if (PLACEHOLDER_LOCAL.test(local)) return INVALID_EMAIL_ADDRESS_CODE;

  return null;
}
