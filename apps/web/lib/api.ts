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

export async function api<T>(
  path: string,
  options: RequestInit = {},
  locale?: Locale,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept-Language", localeHeader(locale));
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = detailFromBody(data, detail);
    } catch {
      /* ignore */
    }

    if (res.status === 401) {
      logoutToHome("expired");
      throw new ApiError(typeof detail === "string" ? detail : "Unauthorized", 401);
    }

    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
