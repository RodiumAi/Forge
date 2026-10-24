import { describe, expect, it } from "vitest";
import { forgeFeatureEnabled, type ForgeStatus } from "@/lib/forge-status";

function status(entitlements: ForgeStatus["entitlements"]): ForgeStatus {
  return { frodi: null, rodi: null, plan: entitlements?.plan_slug ?? null, entitlements };
}

const BASE = {
  plan_slug: "builder",
  status: "active",
  max_projects: 10,
  model_selection: false,
  custom_domain: false,
  export_enabled: false,
  history_enabled: false,
  priority_generation: false,
  allowed_model_tiers: null,
  frodi_balance: 0,
};

describe("Forge Design rights", () => {
  it("stay open when no plan applies (open source, BYOK)", () => {
    expect(forgeFeatureEnabled(status(null), "export_pptx")).toBe(true);
    expect(forgeFeatureEnabled(null, "remove_badge")).toBe(true);
  });

  it("follow the cached plan, absent meaning not granted", () => {
    expect(forgeFeatureEnabled(status(BASE), "export_pdf")).toBe(false);
    expect(forgeFeatureEnabled(status({ ...BASE, export_pdf: true }), "export_pdf")).toBe(true);
    expect(forgeFeatureEnabled(status({ ...BASE, design_system_sharing: true }), "export_html")).toBe(false);
  });
});
