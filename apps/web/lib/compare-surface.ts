/**
 * Which product a row of the plan comparison table applies to.
 *
 * The admin writes `surface` ("forge", "code" or "both") on each row of a
 * plan's `entitlements.compare`. This landing is the Forge one, so a row that
 * applies to RodiumAi Code only is left out. Rows written before `surface`
 * existed carry an optional `forgeOnly` flag, and the default is that only the
 * FRODI allowance is shared with Code.
 *
 * Same rule as `rowSurface` in the user app (`lib/forge/pricing.ts`) and the
 * admin (`lib/forge/compare-rows.ts`).
 */

export type BenefitSurface = "forge" | "code" | "both";

const SURFACES: readonly BenefitSurface[] = ["forge", "code", "both"];

/** The one benefit that also applies to RodiumAi Code. */
export const CODE_BENEFIT_ID = "frodi";

export function rowSurface(
  id: string,
  stored?: { surface?: unknown; forgeOnly?: boolean | null } | null,
): BenefitSurface {
  const surface = stored?.surface;
  if (typeof surface === "string" && (SURFACES as readonly string[]).includes(surface)) {
    return surface as BenefitSurface;
  }
  const forgeOnly =
    typeof stored?.forgeOnly === "boolean" ? stored.forgeOnly : id !== CODE_BENEFIT_ID;
  return forgeOnly ? "forge" : "both";
}

/** Does the Forge pricing show this row? Only Code-only rows are left out. */
export function showsOnForge(
  id: string,
  stored?: { surface?: unknown; forgeOnly?: boolean | null } | null,
): boolean {
  return rowSurface(id, stored) !== "code";
}
