"use client";

/**
 * Which templates the account's Forge plan may start a project from.
 *
 * The catalogue tells each kit's lowest plan (`required_plan`: null for the
 * free kits, "starter", or "builder" for design systems). Previews and details
 * stay open to everyone; only "Use" is locked. The API refuses the fork the
 * same way (`TEMPLATE_NOT_IN_PLAN`, `DESIGN_SYSTEM_NOT_IN_PLAN`).
 *
 * Off Forge Cloud, or before the plan is known, nothing is shown as locked:
 * the UI never hides what it cannot prove is closed.
 */

import { planSlugOf, useForgeStatus, type ForgeStatus } from "@/lib/forge-status";

export type TemplatePlan = "starter" | "builder";

export const TEMPLATE_PLAN_NAMES: Record<TemplatePlan, string> = { starter: "Starter", builder: "Builder" };

const RANK: Record<string, number> = { free: 0, starter: 1, builder: 2 };

/** Kits that need a paid plan (the Free plan cannot start a project from them). */
export function isPremiumTemplate(template: { required_plan?: TemplatePlan | null; kind?: string | null }): boolean {
  return Boolean(template.required_plan ?? template.kind === "design_system");
}

/** The plan to reach for this kit, or null when the account may use it. */
export function lockedPlan(
  template: { required_plan?: TemplatePlan | null; kind?: string | null } | null | undefined,
  status: ForgeStatus | null,
): TemplatePlan | null {
  const need = template?.required_plan ?? (template?.kind === "design_system" ? "builder" : null);
  if (!need) return null;
  const slug = planSlugOf(status)?.trim().toLowerCase();
  if (!slug) return null;
  // Plans above Builder (pro, scale, team-*) are not in the table: they unlock everything.
  const rank = slug in RANK ? RANK[slug] : Number.POSITIVE_INFINITY;
  return rank >= RANK[need] ? null : need;
}

export function useTemplateLock(
  template: { required_plan?: TemplatePlan | null; kind?: string | null } | null | undefined,
): TemplatePlan | null {
  return lockedPlan(template, useForgeStatus());
}

/** The plan named by a refused fork (403 TEMPLATE_NOT_IN_PLAN or DESIGN_SYSTEM_NOT_IN_PLAN). */
export function refusedPlan(err: unknown): TemplatePlan | null {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "TEMPLATE_NOT_IN_PLAN") return "starter";
  if (code === "DESIGN_SYSTEM_NOT_IN_PLAN") return "builder";
  return null;
}
