import { describe, expect, it } from "vitest";
import { failedTasksFromPlan, isPlanStopped, isResumableRunStatus } from "./plan-resume";

describe("isResumableRunStatus", () => {
  it("treats partial, error, awaiting and running runs as resumable", () => {
    for (const status of ["partial", "error", "awaiting_plan_confirm", "awaiting_clarify", "running"]) {
      expect(isResumableRunStatus(status)).toBe(true);
    }
  });

  it("treats done, cancelled and expired runs as not resumable", () => {
    for (const status of ["done", "cancelled", "expired", "interrupted"]) {
      expect(isResumableRunStatus(status)).toBe(false);
    }
  });

  it("handles missing status", () => {
    expect(isResumableRunStatus(null)).toBe(false);
    expect(isResumableRunStatus(undefined)).toBe(false);
  });
});

describe("failedTasksFromPlan", () => {
  it("extracts only the error tasks, keyed by id and label", () => {
    const tasks = [
      { id: "a", title: "Architecture", status: "error" },
      { id: "b", title: "Pages", status: "done" },
      { id: "c", title: "Flows", status: "pending" },
    ];
    expect(failedTasksFromPlan(tasks)).toEqual([{ id: "a", label: "Architecture" }]);
  });

  it("falls back to the id when the task has no title", () => {
    const tasks = [{ id: "a", title: "", status: "error" }];
    expect(failedTasksFromPlan(tasks)).toEqual([{ id: "a", label: "a" }]);
  });

  it("returns nothing for a fully completed plan", () => {
    const tasks = [{ id: "a", title: "A", status: "done" }];
    expect(failedTasksFromPlan(tasks)).toEqual([]);
  });
});

describe("isPlanStopped", () => {
  it("is true when tasks after the failed one were never attempted", () => {
    const tasks = [
      { id: "architecture", title: "Architecture", status: "error" },
      { id: "pages", title: "Pages", status: "pending" },
      { id: "coherence", title: "Coherence", status: "pending" },
    ];
    expect(isPlanStopped(tasks)).toBe(true);
  });

  it("is false when the plan ran to the end despite the failure", () => {
    const tasks = [
      { id: "a", title: "A", status: "error" },
      { id: "b", title: "B", status: "done" },
    ];
    expect(isPlanStopped(tasks)).toBe(false);
  });

  it("is false when nothing failed", () => {
    const tasks = [{ id: "a", title: "A", status: "done" }];
    expect(isPlanStopped(tasks)).toBe(false);
  });
});
