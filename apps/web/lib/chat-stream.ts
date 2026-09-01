/**
 * Pure state machine for the agent SSE stream.
 *
 * Extracted from the builder page so the tricky transitions can be tested:
 * plan auto-run, `task:*` steps syncing the checklist, an error marking running
 * tasks as failed and deciding whether the plan is resumable, cancellation, and
 * the final `done` snapshot.
 *
 * Side effects (preview refresh, routing, message list) are returned as
 * descriptors instead of being performed here, so the reducer stays testable
 * and the component keeps ownership of them.
 */

import type { AgentStep, AgentWarning, FileOp } from "@/components/AgentActivityPanel";
import type { ClarifyQuestion } from "@/components/ClarifyCard";
import type { PlanTask } from "@/components/PlanPanel";

export type ChatStreamState = {
  streaming: string;
  thinking: string;
  steps: AgentStep[];
  ops: FileOp[];
  warnings: AgentWarning[];
  effort: string | null;
  summary: string;
  planTasks: PlanTask[];
  planNeedsConfirm: boolean;
  clarify: ClarifyQuestion[];
  activeRunId: string | null;
  busy: boolean;
  /** True once the run wrote at least one file. */
  applied: boolean;
  /** Plan task currently executing, so file ops can be grouped under it. */
  currentTaskId: string | null;
};

export function initialStreamState(): ChatStreamState {
  return {
    streaming: "",
    thinking: "",
    steps: [],
    ops: [],
    warnings: [],
    effort: null,
    summary: "",
    planTasks: [],
    planNeedsConfirm: false,
    clarify: [],
    activeRunId: null,
    busy: true,
    applied: false,
    currentTaskId: null,
  };
}

export type FinalizePayload = {
  content: string;
  plan: PlanTask[];
  thinking: string;
  steps: AgentStep[];
  ops: FileOp[];
  effort: string | null;
  /** Whether the preview should be refreshed and focused. */
  applied: boolean;
};

export type ChatStreamEffect =
  | { kind: "clear-boot" }
  | { kind: "run-started"; runId: string }
  | { kind: "refresh-routes" }
  | { kind: "schedule-preview-refresh" }
  | { kind: "ensure-preview-started" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string }
  | { kind: "finalize"; payload: FinalizePayload };

export type ReduceOptions = {
  /** Fallback message when the server sends an error with no text. */
  streamErrorLabel: string;
  /** Fallback assistant text when the run produced no summary. */
  emptySummaryLabel: string;
};

export type ReduceResult = {
  state: ChatStreamState;
  effects: ChatStreamEffect[];
};

const BOOT_CLEARING_TYPES = new Set(["user_message", "step", "token", "route", "clarify", "plan"]);

function normalizeTasks(raw: unknown, defaultStatus = "pending"): PlanTask[] {
  if (!Array.isArray(raw)) return [];
  return (raw as PlanTask[]).map((task, i) => ({
    ...task,
    id: String(task.id || `task_${i + 1}`),
    status: task.status || defaultStatus,
  }));
}

export function reduceStreamEvent(
  state: ChatStreamState,
  event: Record<string, unknown>,
  opts: ReduceOptions,
): ReduceResult {
  const type = String(event.type || "");
  const effects: ChatStreamEffect[] = [];
  let next = state;

  if (BOOT_CLEARING_TYPES.has(type)) effects.push({ kind: "clear-boot" });

  if (type === "user_message" && typeof event.run_id === "string") {
    effects.push({ kind: "run-started", runId: event.run_id });
    return { state: { ...next, activeRunId: event.run_id }, effects };
  }

  if (type === "token") {
    return { state: { ...next, streaming: next.streaming + String(event.content || "") }, effects };
  }

  if (type === "thinking") {
    return { state: { ...next, thinking: next.thinking + String(event.delta || "") }, effects };
  }

  if (type === "step") {
    const step: AgentStep = {
      id: String(event.id),
      label: String(event.label || ""),
      status: String(event.status || "running"),
    };
    const withoutBoot = next.steps.filter((s) => s.id !== "boot");
    const i = withoutBoot.findIndex((s) => s.id === step.id);
    const steps = i === -1 ? [...withoutBoot, step] : withoutBoot.map((s, k) => (k === i ? step : s));

    // The dispatcher reports task progress as `task:<id>` steps; keep the plan
    // checklist in sync from the same source, and remember which task is
    // running so file operations can be grouped under it.
    let planTasks = next.planTasks;
    let currentTaskId = next.currentTaskId;
    if (step.id.startsWith("task:")) {
      const tid = step.id.slice("task:".length);
      if (step.status === "running") currentTaskId = tid;
      planTasks = planTasks.map((task) =>
        String(task.id) === tid
          ? { ...task, status: step.status, title: step.label || task.title }
          : task,
      );
    }
    return { state: { ...next, steps, planTasks, currentTaskId }, effects };
  }

  if (type === "route") {
    return { state: { ...next, effort: (event.effort_label as string) || null }, effects };
  }

  if (type === "clarify") {
    const questions = Array.isArray(event.questions) ? (event.questions as ClarifyQuestion[]) : [];
    return {
      state: {
        ...next,
        activeRunId: typeof event.run_id === "string" ? event.run_id : next.activeRunId,
        clarify: questions,
        planNeedsConfirm: false,
        busy: false,
      },
      effects,
    };
  }

  if (type === "plan") {
    const needs = Boolean(event.needs_confirm);
    const tasks = normalizeTasks(event.tasks);
    // Auto-run: show the first task as running immediately, otherwise the UI
    // stays silent until the first task:* step arrives.
    if (!needs && tasks.length) tasks[0] = { ...tasks[0], status: "running" };
    return {
      state: {
        ...next,
        activeRunId: typeof event.run_id === "string" ? event.run_id : next.activeRunId,
        planTasks: tasks,
        planNeedsConfirm: needs,
        clarify: [],
        busy: needs ? false : next.busy,
      },
      effects,
    };
  }

  if (type === "plan_task") {
    const tid = String(event.id || "");
    const status = String(event.status || "running");
    const label = String(event.label || "");
    return {
      state: {
        ...next,
        planTasks: next.planTasks.map((task) =>
          String(task.id) === tid ? { ...task, status, title: label || task.title } : task,
        ),
      },
      effects,
    };
  }

  if (type === "file_write" || type === "file_delete") {
    const op: FileOp = {
      op: type === "file_write" ? "write" : "delete",
      path: String(event.path),
      taskId: next.currentTaskId || undefined,
    };
    next = { ...next, ops: [...next.ops, op], applied: true };
    effects.push({ kind: "schedule-preview-refresh" });
    if (type === "file_write") {
      effects.push({ kind: "refresh-routes" }, { kind: "ensure-preview-started" });
    }
    return { state: next, effects };
  }

  if (type === "preview_refresh") {
    effects.push({ kind: "schedule-preview-refresh" });
    return { state: next, effects };
  }

  if (type === "warning") {
    const violation =
      event.violation && typeof event.violation === "object"
        ? (event.violation as { code?: string; path?: string })
        : null;
    return {
      state: {
        ...next,
        warnings: [
          ...next.warnings,
          {
            code: violation?.code,
            path: violation?.path,
            message: String(event.message || ""),
          },
        ],
      },
      effects,
    };
  }

  if (type === "error") {
    const message = String(event.message || opts.streamErrorLabel);
    if (message === "cancelled") {
      effects.push({ kind: "cancelled" });
      return {
        state: { ...next, planTasks: [], planNeedsConfirm: false, activeRunId: null, busy: false },
        effects,
      };
    }
    const base = Array.isArray(event.plan) ? normalizeTasks(event.plan) : next.planTasks;
    const planTasks = base.map((task) =>
      task.status === "running" ? { ...task, status: "error" } : task,
    );
    const canResume = planTasks.some((t) => t.status === "pending" || t.status === "error");
    effects.push({ kind: "error", message });
    return {
      state: { ...next, planTasks, planNeedsConfirm: canResume, busy: false },
      effects,
    };
  }

  if (type === "done") {
    const summary = typeof event.summary === "string" ? event.summary : "";
    const content = summary.trim() || next.streaming.trim() || opts.emptySummaryLabel;
    const paused = Boolean(event.paused);
    const finalPlan = Array.isArray(event.plan)
      ? normalizeTasks(event.plan, paused ? "pending" : "done")
      : [];
    const appliedList = Array.isArray(event.applied) ? (event.applied as unknown[]) : [];
    const applied = next.applied || appliedList.length > 0;

    effects.push({
      kind: "finalize",
      payload: {
        content,
        plan: finalPlan,
        thinking: next.thinking,
        steps: next.steps,
        ops: next.ops,
        effort: next.effort || (event.effort_label as string) || null,
        applied,
      },
    });

    if (paused) {
      // Step-by-step mode: the run paused after one task. Keep the plan and
      // run id alive so the panel can offer "next step" / "run all".
      return {
        state: {
          ...initialStreamState(),
          busy: false,
          activeRunId: next.activeRunId,
          planTasks: finalPlan,
          planNeedsConfirm: true,
        },
        effects,
      };
    }

    return {
      state: { ...initialStreamState(), busy: false, activeRunId: null },
      effects,
    };
  }

  return { state: next, effects };
}

/** Convenience: fold a whole event sequence, for tests and for replay. */
export function reduceStreamEvents(
  events: Record<string, unknown>[],
  opts: ReduceOptions,
  start: ChatStreamState = initialStreamState(),
): ReduceResult {
  let state = start;
  const effects: ChatStreamEffect[] = [];
  for (const event of events) {
    const result = reduceStreamEvent(state, event, opts);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}
