/**
 * One place that turns a generation failure into something the user can act on.
 *
 * Before this, every failure took a different path to the screen and most
 * arrived unusable. An empty RODI wallet reached the chat as "Payment
 * Required" — the bare HTTP status line — because the three raw-`fetch` stream
 * call sites each parsed error bodies themselves, and one of them tested
 * `typeof data.detail === "string"`, which is false for the API's own
 * `{code, message}` shape. Everything else collapsed into a single
 * "Connection interrupted", whether the socket dropped, the session expired or
 * the model refused.
 *
 * So: the API now attaches a stable `code` to every failure (HTTP body and SSE
 * frame alike), and this module is the only thing that reads it. It answers two
 * questions — what do we tell the user, and what one button do we offer — and
 * nothing else in the app is allowed to guess.
 *
 * Adding a code on the API side without adding it here is safe: it falls
 * through to the server's own message plus a plain Retry.
 */

import { ApiError } from "@/lib/api";

/** What the single button under the message does. */
export type ChatErrorAction =
  /** Re-run whatever the user was doing. Filled in by the caller. */
  | { kind: "retry" }
  /** Open the RodiumAI top-up page. */
  | { kind: "recharge" }
  /** Re-link the RodiumAI account (OIDC). */
  | { kind: "reconnect-rodium" }
  /** Pick up a plan that stopped part-way. */
  | { kind: "resume-plan" }
  /** Generation settings — API key, model. */
  | { kind: "open-settings" }
  /** Ambiguous visual edit: send a chat prompt to apply the change via the agent. */
  | { kind: "edit-in-chat"; prompt: string }
  /** Nothing to click; the message alone says what to do. */
  | { kind: "none" };

export type ChatErrorLabelKey =
  | "streamError"
  | "streamErrorQuota"
  | "streamErrorAuth"
  | "streamErrorInvalidKey"
  | "streamErrorTimeout"
  | "streamErrorTooLarge"
  | "streamErrorEmpty"
  | "streamErrorService"
  | "streamErrorStorage"
  | "streamErrorCancelled";

export type ChatErrorInfo = {
  /** i18n key for the sentence shown to the user, or null to use `message`. */
  labelKey: ChatErrorLabelKey | null;
  /** Server text, kept for codes we have no wording of our own for. */
  message: string;
  action: ChatErrorAction;
  code?: string;
};

/**
 * Codes emitted by `apps/api`.
 *
 * Two families on purpose: SCREAMING_CASE from `app/errors.py` (HTTP bodies)
 * and snake_case from `app/services/llm.py` (SSE frames). They are kept
 * distinct rather than normalised so a grep for either side finds this table.
 */
const BY_CODE: Record<string, { labelKey: ChatErrorLabelKey; action: ChatErrorAction }> = {
  // ── No credit ────────────────────────────────────────────────────────────
  INSUFFICIENT_RODI: { labelKey: "streamErrorQuota", action: { kind: "recharge" } },
  quota: { labelKey: "streamErrorQuota", action: { kind: "recharge" } },

  // ── The RodiumAI link ────────────────────────────────────────────────────
  RODIUM_LINK_EXPIRED: { labelKey: "streamErrorAuth", action: { kind: "reconnect-rodium" } },
  auth_expired: { labelKey: "streamErrorAuth", action: { kind: "reconnect-rodium" } },
  invalid_key: { labelKey: "streamErrorInvalidKey", action: { kind: "open-settings" } },

  // ── Transport ────────────────────────────────────────────────────────────
  // A dropped connection is the one case where the work usually survived on
  // the server, so the useful button resumes rather than restarts.
  network: { labelKey: "streamError", action: { kind: "resume-plan" } },
  timeout: { labelKey: "streamErrorTimeout", action: { kind: "resume-plan" } },
  auth_busy: { labelKey: "streamErrorTimeout", action: { kind: "retry" } },
  run_detached: { labelKey: "streamError", action: { kind: "resume-plan" } },

  // ── The request or the model ─────────────────────────────────────────────
  payload_too_large: { labelKey: "streamErrorTooLarge", action: { kind: "none" } },
  empty_response: { labelKey: "streamErrorEmpty", action: { kind: "retry" } },
  upstream: { labelKey: "streamErrorService", action: { kind: "retry" } },
  internal: { labelKey: "streamErrorService", action: { kind: "retry" } },

  // ── Other quotas ─────────────────────────────────────────────────────────
  STORAGE_QUOTA_EXCEEDED: { labelKey: "streamErrorStorage", action: { kind: "open-settings" } },

  // ── Not a failure ────────────────────────────────────────────────────────
  cancelled: { labelKey: "streamErrorCancelled", action: { kind: "none" } },
};

/**
 * Last-resort classification for failures that carry no code.
 *
 * These are errors raised in the browser itself (a `fetch` that never reached
 * the server) plus messages from API versions predating the code field. Kept
 * deliberately small: matching English prose is what this module exists to
 * replace, not extend.
 */
function codeFromLooseMessage(raw: string): string | null {
  if (
    /failed to fetch|networkerror|network request failed|load failed|network error|incomplete chunked|peer closed connection|connection reset|err_network|stream ended early|rodiumai error \(network\)/i.test(
      raw,
    )
  ) {
    return "network";
  }
  if (/timed out|timeout|délai/i.test(raw)) return "timeout";
  if (
    /rodiumai session expired|sign in with rodiumai again|account is not linked|invalid_grant|refresh token is invalid|session rodiumai expir/i.test(
      raw,
    )
  ) {
    return "auth_expired";
  }
  if (/invalid or unauthorized rodiumai key|clé rodiumai invalide/i.test(raw)) return "invalid_key";
  if (/entity too large|payload_too_large|payloadtoolarge|too large to send|trop volumineuse/i.test(raw)) {
    return "payload_too_large";
  }
  if (/quota|insufficient rodi|solde|balance/i.test(raw)) return "quota";
  if (/rodiumai error \(5\d\d\)|internal_error|unexpected error occurred|erreur rodiumai \(5\d\d\)/i.test(raw)) {
    return "upstream";
  }
  return null;
}

/** HTTP status as a coarse fallback when there is no code and no match. */
function codeFromStatus(status: number): string | null {
  if (status === 402) return "quota";
  if (status === 401 || status === 403) return "auth_expired";
  if (status === 413) return "payload_too_large";
  if (status === 0 || status === 504) return "network";
  if (status >= 500) return "upstream";
  return null;
}

/**
 * Classify anything that can end a generation: an `ApiError`, an `Error`
 * carrying a message, or an SSE `error` frame's `{code, message}`.
 */
export function classifyChatError(
  err: unknown,
  explicitCode?: string,
): ChatErrorInfo {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const status = err instanceof ApiError ? err.status : undefined;
  // Any error carrying a `code` counts, not just ApiError: SSE frames arrive
  // as their own Error subclass and their code is just as authoritative.
  const carried =
    err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  const code =
    explicitCode ||
    carried ||
    codeFromLooseMessage(message) ||
    (status !== undefined ? codeFromStatus(status) : null) ||
    undefined;

  const known = code ? BY_CODE[code] : undefined;
  if (known) {
    return { labelKey: known.labelKey, message, action: known.action, code };
  }
  // Unknown cause: the server's own sentence beats anything we could invent,
  // and it is never an HTTP status line any more — `readApiError` reads the
  // body first. Plain Retry, because we cannot promise anything better.
  return { labelKey: message ? null : "streamError", message, action: { kind: "retry" }, code };
}

/** True when the failure is worth silently reconnecting to instead of showing. */
export function isRecoverableStreamError(err: unknown, explicitCode?: string): boolean {
  const { code } = classifyChatError(err, explicitCode);
  return code === "network" || code === "timeout";
}
