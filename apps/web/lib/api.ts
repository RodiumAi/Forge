import type { Locale } from "@/lib/i18n/dictionaries";
import { resetPosthogUser } from "@/lib/posthog/client";

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8100";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("forge_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("forge_token", token);
  else {
    localStorage.removeItem("forge_token");
    try {
      sessionStorage.removeItem("forge_session_v1");
      // The media token outlives the session otherwise — an hour of read
      // access left behind for whoever uses this browser next.
      sessionStorage.removeItem("forge_media_token_v1");
    } catch {
      /* ignore */
    }
  }
}

/**
 * Pages that own their own error display. A 401 here is an expected answer —
 * a wrong password, an expired link — not a dead session, so bouncing the
 * visitor to the landing page would throw away the message they need to read.
 */
const SELF_HANDLING_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

/** Clear session and send the user to the landing page. */
export function logoutToHome(reason?: string) {
  if (typeof window === "undefined") return;
  resetPosthogUser();
  setToken(null);
  const path = window.location.pathname;
  if (path === "/" || path.startsWith("/auth") || SELF_HANDLING_AUTH_PATHS.includes(path)) return;
  const url = reason ? `/?auth=${encodeURIComponent(reason)}` : "/";
  window.location.replace(url);
}

export class ApiError extends Error {
  status: number;

  /**
   * Machine-readable cause from the API body (`{"detail": {"code", "message"}}`).
   *
   * Without it, callers classified failures by matching English substrings
   * against `message` — a test that silently stops working the day those
   * strings are translated, and that cannot distinguish "no RODI left" from
   * any other 402. `lib/chat-errors.ts` maps this to a sentence and an action.
   */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Network-level failure (DNS, offline, timeout, connection reset).
 *
 * Modelled as an ApiError with status 0 so that every `catch (e) { e instanceof
 * ApiError }` site handles it. Previously a dropped connection surfaced as a raw
 * TypeError and slipped through those guards.
 */
export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 0);
    this.name = "NetworkError";
  }
}

export type ApiOptions = RequestInit & {
  /** Abort after N ms. Default 90 s; pass 0 to disable (SSE/streams). */
  timeoutMs?: number;
  /** Extra attempts on network errors / 502-504. Default 2. */
  retries?: number;
};

// 90s, not 30s: during a generation the backend legitimately spends long spans
// on LLM calls and file batches, and calls made alongside (preview restart,
// file tree) must not be killed by an aggressive client-side deadline.
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_RETRIES = 2;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
/** Retries only make sense for operations that are safe to repeat. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function localeHeader(explicit?: Locale): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "fr";
  return localStorage.getItem("forge_locale") === "en" ? "en" : "fr";
}

export type ApiErrorBody = { message: string; code?: string };

export function detailFromBody(data: unknown, fallback: string): ApiErrorBody {
  if (!data || typeof data !== "object") return { message: fallback };
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return { message: detail };

  // FastAPI reports request-validation failures as an array of objects
  // ({type, loc, msg, ctx}). Stringifying that put things like
  // `[{"type":"string_too_short","loc":["body","token"],…}]` in front of the
  // user. Take the human-readable `msg` fields instead.
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && typeof (item as { msg?: unknown }).msg === "string"
          ? ((item as { msg: string }).msg)
          : null,
      )
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length) return { message: messages.join(". ") };
    return { message: fallback };
  }

  // The API's own error shape: {"detail": {"code": "INSUFFICIENT_RODI",
  // "message": "…"}}. Both halves matter — the message is what the user reads
  // when we have no better wording, the code is what earns them a button.
  if (detail && typeof detail === "object") {
    const obj = detail as { message?: unknown; code?: unknown };
    const message = typeof obj.message === "string" ? obj.message : fallback;
    const code = typeof obj.code === "string" ? obj.code : undefined;
    if (message !== fallback || code) return { message, code };
  }
  // Anything else is a shape we did not anticipate. Showing raw JSON is worse
  // than saying nothing useful, so fall back to the status text.
  return { message: fallback };
}

/**
 * Read an error response the way `api()` does.
 *
 * Exported because the SSE call sites cannot use `api()` (they need the raw
 * `ReadableStream`) and each grew its own parser instead. One of them checked
 * `typeof data.detail === "string"`, which is false for the API's own
 * `{code, message}` shape — so an empty RODI wallet reached the user as the
 * bare HTTP status line, "Payment Required". One parser, one behaviour.
 */
export async function readApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody = { message: res.statusText };
  try {
    body = detailFromBody(await res.clone().json(), res.statusText);
  } catch {
    try {
      const text = await res.text();
      if (text) body = { message: text.slice(0, 500) };
    } catch {
      /* keep the status text */
    }
  }
  return new ApiError(body.message || res.statusText, res.status, body.code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Combine an external caller signal with our own timeout signal.
 * `AbortSignal.any` is not available everywhere yet, so wire it manually.
 */
function withTimeout(
  external: AbortSignal | null | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let didTimeout = false;

  const onExternalAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", onExternalAbort);
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
    timedOut: () => didTimeout,
  };
}

export async function api<T>(
  path: string,
  options: ApiOptions = {},
  locale?: Locale,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, ...init } = options;

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept-Language", localeHeader(locale));
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = (init.method || "GET").toUpperCase();
  const maxAttempts = IDEMPOTENT_METHODS.has(method) ? retries + 1 : 1;

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { signal, cleanup, timedOut } = withTimeout(init.signal, timeoutMs);
    let res: Response;

    try {
      res = await fetch(`${apiBase()}${path}`, { ...init, headers, signal });
    } catch (err) {
      cleanup();
      // Caller aborted on purpose: propagate untouched, never retry.
      if (init.signal?.aborted) throw err;
      lastError = new NetworkError(
        timedOut() ? `Request timed out after ${timeoutMs}ms` : "Network request failed",
      );
      if (attempt < maxAttempts - 1) {
        await sleep(2 ** attempt * 300);
        continue;
      }
      throw lastError;
    }
    cleanup();

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    }

    let detail: string = res.statusText;
    let code: string | undefined;
    try {
      const body = detailFromBody(await res.json(), detail);
      detail = body.message;
      code = body.code;
    } catch {
      /* keep statusText */
    }

    // 401 means the session is really gone; do not bounce the user out of the
    // builder for a transient blip — only after retries are exhausted.
    if (res.status === 401) {
      logoutToHome("expired");
      throw new ApiError(detail || "Unauthorized", 401, code);
    }

    // The RodiumAI link is definitively dead (refresh token rejected or tokens
    // cleared): staying "signed in" to Forge while every generation fails with
    // "account is not linked" is incoherent — sign out so the next login
    // re-links the account in one step.
    if (
      res.status === 403 &&
      (code === "RODIUM_LINK_EXPIRED" ||
        /account is not linked|session expired.*sign in with rodiumai|sign in with rodiumai again/i.test(
          detail,
        ))
    ) {
      logoutToHome("expired");
      throw new ApiError(detail, 403, code);
    }

    lastError = new ApiError(detail, res.status, code);
    if (RETRY_STATUSES.has(res.status) && attempt < maxAttempts - 1) {
      await sleep(2 ** attempt * 300);
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new NetworkError("Request failed");
}
