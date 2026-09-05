/**
 * Pure helpers for restoring the "N step(s) did not complete" resume offer
 * after a page refresh.
 *
 * The backend keeps a run resumable (status `partial`, `error`,
 * `awaiting_plan_confirm`, `awaiting_clarify`, `running`) well past the
 * moment the live SSE stream ended. On reload, `load()` re-fetches
 * `/runs/active` and needs to decide whether to show the plan panel + resume
 * button again, and which tasks to list as failed — both derived here so the
 * decision is testable without the whole builder page.
 */

import type { PlanTask } from "@/components/PlanPanel";

export const RESUMABLE_RUN_STATUSES = new Set([
  "awaiting_plan_confirm",
  "awaiting_clarify",
  "running",
  "error",
  "partial",
]);

export function isResumableRunStatus(status: string | null | undefined): boolean {
  return Boolean(status) && RESUMABLE_RUN_STATUSES.has(status as string);
}

/** Tasks a `partial`/`error` plan left behind — what "Retry these steps" re-runs. */
export function failedTasksFromPlan(
  tasks: PlanTask[],
): { id: string; label: string }[] {
  return tasks
    .filter((task) => task.status === "error")
    .map((task) => ({ id: String(task.id), label: task.title || String(task.id) }));
}

/**
 * Whether a restored plan halted on a structural failure rather than
 * degrading past it. The live SSE `done` frame carries this explicitly
 * (`event.stopped`), but a page reload only has the persisted plan to go on:
 * a normal partial run finishes to the end, so every task after the failed
 * one is `done` (or itself `error`); a stopped run never attempts them, so
 * they are still `pending`.
 */
export function isPlanStopped(tasks: PlanTask[]): boolean {
  const errorIdx = tasks.findIndex((task) => task.status === "error");
  if (errorIdx === -1) return false;
  return tasks.slice(errorIdx + 1).some((task) => task.status === "pending" || !task.status);
}
