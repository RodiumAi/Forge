import { describe, expect, it } from "vitest";

import { planCostState, type PlanTask } from "./PlanPanel";

const cost = { low: 110, high: 270 };
const plan = (...statuses: string[]): PlanTask[] =>
  statuses.map((status, i) => ({ id: `t${i}`, title: `Step ${i}`, status }));

describe("planCostState", () => {
  it("estimates only the tasks still to run", () => {
    expect(planCostState(plan("done", "pending", "error"), cost, 5000)).toEqual({
      remaining: 2,
      low: 220,
      high: 540,
      blocked: false,
      short: false,
    });
  });

  it("blocks when the balance cannot pay for a single step", () => {
    expect(planCostState(plan("pending", "pending"), cost, 36)?.blocked).toBe(true);
  });

  it("warns without blocking when only part of the plan is covered", () => {
    const state = planCostState(plan(...Array(11).fill("pending")), cost, 300);
    expect(state?.blocked).toBe(false);
    expect(state?.short).toBe(true);
  });

  it("stays silent off Forge Cloud or when nothing is left", () => {
    expect(planCostState(plan("pending"), null, 100)).toBeNull();
    expect(planCostState(plan("pending"), cost, null)).toBeNull();
    expect(planCostState(plan("done"), cost, 100)).toBeNull();
  });
});
