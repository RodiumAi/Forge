import type { Locale } from "@/lib/i18n/dictionaries";

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
    } catch {
      /* ignore */
    }
  }
}

/** Clear session and send the user to the landing page. */
export function logoutToHome(reason?: string) {
  if (typeof window === "undefined") return;
  setToken(null);
  const path = window.location.pathname;
  if (path === "/" || path === "/login" || path.startsWith("/auth")) return;
  const url = reason ? `/?auth=${encodeURIComponent(reason)}` : "/";
  window.location.replace(url);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
  /** Abort after N ms. Default 30 s; pass 0 to disable (SSE/streams). */
  timeoutMs?: number;
  /** Extra attempts on network errors / 502-504. Default 2. */
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
/** Retries only make sense for operations that are safe to repeat. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function localeHeader(explicit?: Locale): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "fr";
  return localStorage.getItem("forge_locale") === "en" ? "en" : "fr";
}

function detailFromBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const msg = (detail as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  try {
    return JSON.stringify(detail ?? data);
  } catch {
    return fallback;
  }
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
    try {
      detail = detailFromBody(await res.json(), detail);
    } catch {
      /* keep statusText */
    }

    // 401 means the session is really gone; do not bounce the user out of the
    // builder for a transient blip — only after retries are exhausted.
    if (res.status === 401) {
      logoutToHome("expired");
      throw new ApiError(detail || "Unauthorized", 401);
    }

    lastError = new ApiError(detail, res.status);
    if (RETRY_STATUSES.has(res.status) && attempt < maxAttempts - 1) {
      await sleep(2 ** attempt * 300);
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new NetworkError("Request failed");
}
