import { describe, expect, it } from "vitest";
import {
  initialStreamState,
  reduceStreamEvent,
  reduceStreamEvents,
  type ChatStreamEffect,
} from "./chat-stream";

const OPTS = { streamErrorLabel: "Stream error", emptySummaryLabel: "Done." };

const run = (events: Record<string, unknown>[]) => reduceStreamEvents(events, OPTS);
const kinds = (effects: ChatStreamEffect[]) => effects.map((e) => e.kind);

describe("tokens and thinking", () => {
  it("accumulates streamed text", () => {
    const { state } = run([
      { type: "token", content: "Hel" },
      { type: "token", content: "lo" },
    ]);
    expect(state.streaming).toBe("Hello");
  });

  it("accumulates reasoning separately from the answer", () => {
    const { state } = run([
      { type: "thinking", delta: "a" },
      { type: "token", content: "b" },
      { type: "thinking", delta: "c" },
    ]);
    expect(state.thinking).toBe("ac");
    expect(state.streaming).toBe("b");
  });
});

describe("steps", () => {
  it("replaces a step in place instead of appending twice", () => {
    const { state } = run([
      { type: "step", id: "s1", label: "Generating", status: "running" },
      { type: "step", id: "s1", label: "Generating", status: "done" },
    ]);
    expect(state.steps).toEqual([{ id: "s1", label: "Generating", status: "done" }]);
  });

  it("drops the synthetic boot step once a real one arrives", () => {
    const start = { ...initialStreamState(), steps: [{ id: "boot", label: "…", status: "running" }] };
    const { state } = reduceStreamEvent(start, { type: "step", id: "s1", status: "running" }, OPTS);
    expect(state.steps.map((s) => s.id)).toEqual(["s1"]);
  });

  it("syncs the plan checklist from task:* steps", () => {
    const { state } = run([
      { type: "plan", needs_confirm: true, tasks: [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }] },
      { type: "step", id: "task:t2", label: "Two revised", status: "running" },
    ]);
    expect(state.planTasks).toEqual([
      { id: "t1", title: "One", status: "pending" },
      { id: "t2", title: "Two revised", status: "running" },
    ]);
  });
});

describe("plan", () => {
  it("marks the first task running when the plan auto-runs", () => {
    const { state } = run([
      { type: "plan", needs_confirm: false, tasks: [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }] },
    ]);
    expect(state.planTasks[0].status).toBe("running");
    expect(state.planTasks[1].status).toBe("pending");
    expect(state.busy).toBe(true);
  });

  it("stops the busy state and waits when confirmation is required", () => {
    const { state } = run([
      { type: "plan", needs_confirm: true, tasks: [{ id: "t1", title: "One" }] },
    ]);
    expect(state.planTasks[0].status).toBe("pending");
    expect(state.planNeedsConfirm).toBe(true);
    expect(state.busy).toBe(false);
  });

  it("generates ids for tasks that lack one", () => {
    const { state } = run([{ type: "plan", needs_confirm: true, tasks: [{ title: "x" }, { title: "y" }] }]);
    expect(state.planTasks.map((t) => t.id)).toEqual(["task_1", "task_2"]);
  });

  it("clears pending clarify questions", () => {
    const { state } = run([
      { type: "clarify", questions: [{ id: "q1", prompt: "?", options: [] }] },
      { type: "plan", needs_confirm: true, tasks: [{ id: "t1" }] },
    ]);
    expect(state.clarify).toEqual([]);
  });

  it("updates a single task on plan_task", () => {
    const { state } = run([
      { type: "plan", needs_confirm: true, tasks: [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }] },
      { type: "plan_task", id: "t1", status: "done" },
    ]);
    expect(state.planTasks.map((t) => t.status)).toEqual(["done", "pending"]);
  });
});

describe("clarify", () => {
  it("releases the composer while waiting for the user", () => {
    const { state } = run([
      { type: "clarify", run_id: "r1", questions: [{ id: "q1", prompt: "?", options: [] }] },
    ]);
    expect(state.busy).toBe(false);
    expect(state.activeRunId).toBe("r1");
    expect(state.clarify).toHaveLength(1);
  });
});

describe("file operations", () => {
  it("records writes and deletes in order", () => {
    const { state } = run([
      { type: "file_write", path: "src/App.tsx" },
      { type: "file_delete", path: "src/Old.tsx" },
    ]);
    expect(state.ops).toEqual([
      { op: "write", path: "src/App.tsx", taskId: undefined },
      { op: "delete", path: "src/Old.tsx", taskId: undefined },
    ]);
    expect(state.applied).toBe(true);
  });

  it("tags ops with the plan task that produced them", () => {
    const { state } = run([
      { type: "plan", needs_confirm: false, tasks: [{ id: "t1" }, { id: "t2" }] },
      { type: "step", id: "task:t1", status: "running" },
      { type: "file_write", path: "src/A.tsx" },
      { type: "step", id: "task:t1", status: "done" },
      { type: "step", id: "task:t2", status: "running" },
      { type: "file_write", path: "src/B.tsx" },
    ]);
    expect(state.ops).toEqual([
      { op: "write", path: "src/A.tsx", taskId: "t1" },
      { op: "write", path: "src/B.tsx", taskId: "t2" },
    ]);
  });

  it("leaves ops untagged outside plan execution", () => {
    const { state } = run([
      { type: "step", id: "generate", status: "running" },
      { type: "file_write", path: "src/A.tsx" },
    ]);
    expect(state.ops[0].taskId).toBeUndefined();
  });

  it("asks to refresh routes and start the preview only on writes — never a preview refresh per file", () => {
    const write = reduceStreamEvent(initialStreamState(), { type: "file_write", path: "a" }, OPTS);
    expect(kinds(write.effects)).toEqual([
      "refresh-routes",
      "ensure-preview-started",
    ]);

    const del = reduceStreamEvent(initialStreamState(), { type: "file_delete", path: "a" }, OPTS);
    expect(kinds(del.effects)).toEqual([]);

    // Preview refreshes are driven by explicit dispatcher events only.
    const refresh = reduceStreamEvent(initialStreamState(), { type: "preview_refresh" }, OPTS);
    expect(kinds(refresh.effects)).toEqual(["schedule-preview-refresh"]);
  });
});

describe("warnings", () => {
  it("keeps import violations with their code and path", () => {
    const { state } = run([
      {
        type: "warning",
        message: "not in manifest",
        violation: { code: "BUILD_FORBIDDEN_IMPORT", path: "src/App.tsx" },
      },
    ]);
    expect(state.warnings).toEqual([
      { code: "BUILD_FORBIDDEN_IMPORT", path: "src/App.tsx", message: "not in manifest" },
    ]);
  });

  it("accepts a warning with no violation payload", () => {
    const { state } = run([{ type: "warning", message: "preview may stay black" }]);
    expect(state.warnings).toEqual([
      { code: undefined, path: undefined, message: "preview may stay black" },
    ]);
  });
});

describe("errors", () => {
  it("marks running tasks as failed and keeps the plan resumable", () => {
    const { state, effects } = run([
      {
        type: "plan",
        needs_confirm: false,
        tasks: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
      },
      { type: "plan_task", id: "t1", status: "done" },
      { type: "plan_task", id: "t2", status: "running" },
      { type: "error", message: "boom" },
    ]);
    expect(state.planTasks.map((t) => t.status)).toEqual(["done", "error", "pending"]);
    expect(state.planNeedsConfirm).toBe(true);
    expect(state.busy).toBe(false);
    expect(effects.at(-1)).toEqual({ kind: "error", message: "boom" });
  });

  it("is not resumable when every task already completed", () => {
    const { state } = run([
      { type: "plan", needs_confirm: true, tasks: [{ id: "t1", status: "done" }] },
      { type: "error", message: "late failure" },
    ]);
    expect(state.planNeedsConfirm).toBe(false);
  });

  it("treats cancellation as a silent reset, not a failure", () => {
    const { state, effects } = run([
      { type: "plan", needs_confirm: false, tasks: [{ id: "t1" }] },
      { type: "error", message: "cancelled" },
    ]);
    expect(state.planTasks).toEqual([]);
    expect(state.planNeedsConfirm).toBe(false);
    expect(state.activeRunId).toBeNull();
    expect(kinds(effects)).toContain("cancelled");
    expect(kinds(effects)).not.toContain("error");
  });

  it("falls back to the localized label when the server sends no message", () => {
    const { effects } = run([{ type: "error" }]);
    expect(effects.at(-1)).toEqual({ kind: "error", message: "Stream error" });
  });
});

describe("done", () => {
  it("prefers the server summary", () => {
    const { effects } = run([
      { type: "token", content: "streamed" },
      { type: "done", summary: "Final summary" },
    ]);
    const finalize = effects.find((e) => e.kind === "finalize");
    expect(finalize).toMatchObject({ payload: { content: "Final summary" } });
  });

  it("falls back to the streamed text when there is no summary", () => {
    const { effects } = run([
      { type: "token", content: "streamed answer" },
      { type: "done" },
    ]);
    expect(effects.find((e) => e.kind === "finalize")).toMatchObject({
      payload: { content: "streamed answer" },
    });
  });

  it("falls back to the localized label when both are empty", () => {
    const { effects } = run([{ type: "done", summary: "   " }]);
    expect(effects.find((e) => e.kind === "finalize")).toMatchObject({
      payload: { content: "Done." },
    });
  });

  it("carries steps, ops, thinking and effort into the final message", () => {
    const { effects } = run([
      { type: "route", effort_label: "medium" },
      { type: "thinking", delta: "reasoning" },
      { type: "step", id: "s1", label: "Generating", status: "done" },
      { type: "file_write", path: "src/App.tsx" },
      { type: "done", summary: "ok" },
    ]);
    expect(effects.find((e) => e.kind === "finalize")).toMatchObject({
      payload: {
        thinking: "reasoning",
        steps: [{ id: "s1", label: "Generating", status: "done" }],
        ops: [{ op: "write", path: "src/App.tsx" }],
        effort: "medium",
        applied: true,
      },
    });
  });

  it("reports applied when only the done event lists writes", () => {
    const { effects } = run([{ type: "done", summary: "ok", applied: [{ path: "a" }] }]);
    expect(effects.find((e) => e.kind === "finalize")).toMatchObject({
      payload: { applied: true },
    });
  });

  it("defaults final plan tasks to done", () => {
    const { effects } = run([{ type: "done", plan: [{ id: "t1" }, { id: "t2", status: "error" }] }]);
    const finalize = effects.find((e) => e.kind === "finalize");
    expect(finalize).toMatchObject({
      payload: { plan: [{ id: "t1", status: "done" }, { id: "t2", status: "error" }] },
    });
  });

  it("keeps the plan and run alive on a paused done (step-by-step mode)", () => {
    const { state, effects } = run([
      { type: "user_message", run_id: "run-9" },
      {
        type: "done",
        paused: true,
        summary: "step 1 ok",
        plan: [{ id: "t1", status: "done" }, { id: "t2" }],
      },
    ]);
    expect(effects.find((e) => e.kind === "finalize")).toMatchObject({
      payload: { content: "step 1 ok" },
    });
    expect(state.activeRunId).toBe("run-9");
    expect(state.planNeedsConfirm).toBe(true);
    expect(state.planTasks).toEqual([
      { id: "t1", status: "done" },
      { id: "t2", status: "pending" },
    ]);
    expect(state.busy).toBe(false);
  });

  it("resets the stream state so the next run starts clean", () => {
    const { state } = run([
      { type: "token", content: "x" },
      { type: "thinking", delta: "y" },
      { type: "warning", message: "w" },
      { type: "done", summary: "ok" },
    ]);
    expect(state.streaming).toBe("");
    expect(state.thinking).toBe("");
    expect(state.warnings).toEqual([]);
    expect(state.steps).toEqual([]);
    expect(state.busy).toBe(false);
    expect(state.activeRunId).toBeNull();
  });
});

describe("boot step clearing", () => {
  it("clears the placeholder for the event types that indicate real progress", () => {
    for (const type of ["user_message", "step", "token", "route", "clarify", "plan"]) {
      const { effects } = reduceStreamEvent(initialStreamState(), { type, run_id: "r" }, OPTS);
      expect(kinds(effects)).toContain("clear-boot");
    }
  });

  it("does not clear it on unrelated events", () => {
    const { effects } = reduceStreamEvent(initialStreamState(), { type: "thinking" }, OPTS);
    expect(kinds(effects)).not.toContain("clear-boot");
  });
});

describe("unknown events", () => {
  it("leaves the state untouched", () => {
    const start = initialStreamState();
    const { state, effects } = reduceStreamEvent(start, { type: "something_new" }, OPTS);
    expect(state).toBe(start);
    expect(effects).toEqual([]);
  });
});
