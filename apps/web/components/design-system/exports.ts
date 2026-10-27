/**
 * Exports offered by the design system editor: the brand guide as a PDF or as
 * Markdown. Gating mirrors `apps/api/app/services/design_system/exports.py`
 * (`require_export`): PDF needs `export_pdf` (Starter and up), Markdown any
 * paid plan. Rank based like the decks: a higher plan includes the formats of
 * the lower ones even when its entitlements lack the flag. Off Forge Cloud (no
 * entitlements) everything is allowed.
 */

import { planReaches } from "@/lib/deck-exports";
import { planSlugOf, type ForgeStatus } from "@/lib/forge-status";

import type { ExportFormat } from "./api";

export const DS_EXPORT_FORMATS = ["pdf", "md"] as const satisfies readonly ExportFormat[];
export type DsExportFormat = (typeof DS_EXPORT_FORMATS)[number];

/** Lowest plan that unlocks each format. */
export const DS_EXPORT_REQUIRED_PLAN: Record<DsExportFormat, "starter"> = { pdf: "starter", md: "starter" };

export type DsExportOption = { format: DsExportFormat; allowed: boolean; requiredPlan: "starter" };

export function designSystemExportAllowed(status: ForgeStatus | null, format: DsExportFormat): boolean {
  const ent = status?.entitlements;
  if (!ent) return true;
  const slug = (planSlugOf(status) ?? "free").trim().toLowerCase();
  if (slug === "free") return false;
  if (format === "pdf") return Boolean(ent.export_pdf) || planReaches(slug, DS_EXPORT_REQUIRED_PLAN.pdf);
  // Markdown: the API accepts every plan but Free.
  return true;
}

export function designSystemExportOptions(status: ForgeStatus | null): DsExportOption[] {
  return DS_EXPORT_FORMATS.map((format) => ({
    format,
    allowed: designSystemExportAllowed(status, format),
    requiredPlan: DS_EXPORT_REQUIRED_PLAN[format],
  }));
}
