"use client";

/**
 * Typed client for the deck exports (`POST /projects/{id}/exports/{format}`)
 * and the slides publication options (`POST /projects/{id}/publish`).
 *
 * An export answers with the file itself. Its name comes from
 * `Content-Disposition`, its warnings (fonts to install, elements exported as
 * pictures, transitions approximated) from `X-Forge-Export-Warnings`
 * (base64url JSON). A format the plan does not include answers 403
 * `EXPORT_NOT_IN_PLAN` with `requiredPlan`: `DeckExportError.upgradeRequired`.
 *
 * Plans (mirror of `apps/api/app/services/exports/gating.py`): Free exports
 * nothing; PDF and PNG from Starter; HTML and PPTX from Builder. Off Forge
 * Cloud (no entitlements) everything is allowed.
 */

import { api, apiBase, ApiError, getToken, NetworkError, readApiError } from "@/lib/api";
import { planSlugOf, type ForgeEntitlements, type ForgeStatus } from "@/lib/forge-status";

export const DECK_EXPORT_FORMATS = ["pdf", "png", "pptx", "html"] as const;
export type DeckExportFormat = (typeof DECK_EXPORT_FORMATS)[number];

type ExportFeature = keyof Pick<ForgeEntitlements, "export_pdf" | "export_html" | "export_pptx">;

export const EXPORT_FEATURE: Record<DeckExportFormat, ExportFeature> = {
  pdf: "export_pdf",
  png: "export_pdf",
  html: "export_html",
  pptx: "export_pptx",
};

/** Lowest plan that unlocks a format. */
export const REQUIRED_PLAN: Record<DeckExportFormat, "starter" | "builder"> = {
  pdf: "starter",
  png: "starter",
  html: "builder",
  pptx: "builder",
};

const NEVER: Record<ExportFeature, string[]> = {
  export_pdf: ["free"],
  export_html: ["free", "starter"],
  export_pptx: ["free", "starter"],
};

export const EXPORT_NOT_IN_PLAN = "EXPORT_NOT_IN_PLAN";
export const WARNINGS_HEADER = "X-Forge-Export-Warnings";
/** Chromium renders every slide; a long deck takes a while. */
export const EXPORT_TIMEOUT_MS = 240_000;

/** Whether the plan includes a format. Unknown status (open source, not loaded) allows. */
export function deckExportAllowed(status: ForgeStatus | null, format: DeckExportFormat): boolean {
  const ent = status?.entitlements;
  if (!ent) return true;
  const feature = EXPORT_FEATURE[format];
  const slug = planSlugOf(status) ?? "free";
  if (NEVER[feature].includes(slug)) return false;
  return Boolean(ent[feature]);
}

/** Whether the "Made with Forge" badge may be removed on this plan. */
export function badgeRemovable(status: ForgeStatus | null): boolean {
  const ent = status?.entitlements;
  if (!ent) return true;
  return (planSlugOf(status) ?? "free") !== "free" && Boolean(ent.remove_badge);
}

export type DeckExportOptions = {
  /** PDF: one page per animation step. */
  steps?: boolean;
  /** HTML and PPTX: include speaker notes (default true). */
  notes?: boolean;
  /** HTML: keep the badge (only plans that may remove it can say false). */
  badge?: boolean;
};

export type DeckExportWarning = {
  code: string;
  message: string;
  font?: string;
  fallback?: string;
  transition?: string;
  element?: string;
};

export type DeckExportResult = {
  blob: Blob;
  filename: string;
  warnings: DeckExportWarning[];
};

export class DeckExportError extends ApiError {
  format: DeckExportFormat;
  requiredPlan?: "starter" | "builder";

  constructor(base: ApiError, format: DeckExportFormat, requiredPlan?: "starter" | "builder") {
    super(base.message, base.status, base.code, base.actions);
    this.name = "DeckExportError";
    this.format = format;
    this.requiredPlan = requiredPlan;
  }

  /** The plan must change before this format can be exported. */
  get upgradeRequired(): boolean {
    return this.status === 403 && this.code === EXPORT_NOT_IN_PLAN;
  }
}

function base64UrlToText(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Warnings header to a list; anything unreadable is dropped. */
export function decodeWarnings(header: string | null | undefined): DeckExportWarning[] {
  if (!header) return [];
  try {
    const parsed: unknown = JSON.parse(base64UrlToText(header));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is DeckExportWarning =>
        !!w && typeof w === "object" && typeof (w as DeckExportWarning).code === "string" && typeof (w as DeckExportWarning).message === "string",
    );
  } catch {
    return [];
  }
}

/** Warning in the interface language; unknown codes keep the API's (English) message. */
export function warningText(w: DeckExportWarning, locale: "fr" | "en"): string {
  if (locale === "en") return w.message;
  switch (w.code) {
    case "FONT_NOT_EMBEDDED":
      return w.font
        ? `Installez la police « ${w.font} » (Google Fonts) pour voir le deck tel quel ; sinon PowerPoint la remplace, par exemple par ${w.fallback ?? "Arial"}.`
        : w.message;
    case "RENDERED_AS_IMAGE":
      return "Certains éléments sont exportés en image (PowerPoint n'a pas d'équivalent) : icônes, vidéos, images arrondies.";
    case "ANIMATIONS_NOT_EXPORTED":
      return "Les animations des éléments ne sont pas exportées ; les transitions de slides le sont.";
    case "TRANSITION_APPROXIMATED":
      return w.transition === "cube"
        ? "La transition cube est exportée en « Pousser »."
        : `La transition ${w.transition ?? ""} est exportée en « Fondu ».`;
    case "IMAGE_MISSING":
    case "RASTER_MISSING":
      return `Un élément n'a pas pu être exporté (${w.element ?? "?"}).`;
    default:
      return w.message;
  }
}

const EXTENSIONS: Record<DeckExportFormat, string> = { pdf: "pdf", png: "zip", pptx: "pptx", html: "html" };

/** File name from Content-Disposition, else `<fallback>.<ext>`. */
export function exportFilename(disposition: string | null, fallback: string, format: DeckExportFormat): string {
  const match = /filename="([^"]+)"/i.exec(disposition ?? "");
  if (match?.[1]) return match[1];
  const base = fallback.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || "presentation";
  return `${base}.${EXTENSIONS[format]}`;
}

function localeHeader(): string {
  if (typeof window === "undefined") return "fr";
  return localStorage.getItem("forge_locale") === "en" ? "en" : "fr";
}

async function readExportError(res: Response, format: DeckExportFormat): Promise<DeckExportError> {
  const base = await readApiError(res);
  let requiredPlan: "starter" | "builder" | undefined;
  try {
    const body = (await res.clone().json()) as { detail?: { requiredPlan?: unknown } };
    const plan = body?.detail?.requiredPlan;
    if (plan === "starter" || plan === "builder") requiredPlan = plan;
  } catch {
    /* not JSON */
  }
  return new DeckExportError(base, format, requiredPlan ?? (base.code === EXPORT_NOT_IN_PLAN ? REQUIRED_PLAN[format] : undefined));
}

/** Runs one export and returns the file. Throws `DeckExportError` (or `NetworkError`). */
export async function exportDeck(
  projectId: string,
  format: DeckExportFormat,
  options: DeckExportOptions = {},
  init: { signal?: AbortSignal; fallbackName?: string; timeoutMs?: number } = {},
): Promise<DeckExportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? EXPORT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onAbort, { once: true });
  const headers = new Headers({ "Content-Type": "application/json", "Accept-Language": localeHeader() });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/exports/${format}`, {
      method: "POST",
      headers,
      body: JSON.stringify(options),
      signal: controller.signal,
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : "Network error");
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
  if (!res.ok) throw await readExportError(res, format);
  const blob = await res.blob();
  return {
    blob,
    filename: exportFilename(res.headers.get("Content-Disposition"), init.fallbackName ?? "presentation", format),
    warnings: decodeWarnings(res.headers.get(WARNINGS_HEADER)),
  };
}

/** Saves a blob through a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type DeckPublishOptions = {
  /** Share speaker notes on the published presenter view (default false). */
  notes?: boolean;
  /** Keep the badge; only plans that may remove it can say false. */
  badge?: boolean;
};

export type DeckPublishResult = {
  ok: boolean;
  public_url: string;
  files_uploaded: number;
  slug: string;
  published_at?: string | null;
};

/** Publishes a slides project (player site on the project's slug or custom domain). */
export function publishDeck(projectId: string, options: DeckPublishOptions = {}, signal?: AbortSignal): Promise<DeckPublishResult> {
  return api<DeckPublishResult>(`/projects/${encodeURIComponent(projectId)}/publish`, {
    method: "POST",
    body: JSON.stringify(options),
    headers: { "Content-Type": "application/json" },
    signal,
    timeoutMs: EXPORT_TIMEOUT_MS,
    retries: 0,
  });
}

/** Presenter view of a published deck. */
export function presenterUrl(publicUrl: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/presenter/`;
}
