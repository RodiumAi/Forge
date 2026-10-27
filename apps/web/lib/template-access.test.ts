import { describe, expect, it } from "vitest";

import type { ForgeStatus } from "@/lib/forge-status";
import { lockedPlan, refusedPlan } from "@/lib/template-access";

const on = (plan_slug: string | null) => ({ entitlements: plan_slug === null ? null : { plan_slug } }) as unknown as ForgeStatus;

describe("lockedPlan", () => {
  it("never locks a free kit", () => {
    expect(lockedPlan({ required_plan: null }, on("free"))).toBeNull();
  });

  it("locks paid kits on Free", () => {
    expect(lockedPlan({ required_plan: "starter" }, on("free"))).toBe("starter");
    expect(lockedPlan({ required_plan: "builder" }, on("Free "))).toBe("builder");
  });

  it("opens kits up to the account's plan", () => {
    expect(lockedPlan({ required_plan: "starter" }, on("starter"))).toBeNull();
    expect(lockedPlan({ required_plan: "builder" }, on("starter"))).toBe("builder");
    expect(lockedPlan({ required_plan: "builder" }, on("team-pro"))).toBeNull();
  });

  it("does not lock while the plan is unknown", () => {
    expect(lockedPlan({ required_plan: "builder" }, null)).toBeNull();
    expect(lockedPlan({ required_plan: "builder" }, on(null))).toBeNull();
  });
});

describe("refusedPlan", () => {
  it("reads the plan from the API refusal", () => {
    expect(refusedPlan({ code: "TEMPLATE_NOT_IN_PLAN" })).toBe("starter");
    expect(refusedPlan({ code: "DESIGN_SYSTEM_NOT_IN_PLAN" })).toBe("builder");
    expect(refusedPlan({ code: "INSUFFICIENT_RODI" })).toBeNull();
    expect(refusedPlan(null)).toBeNull();
  });
});
