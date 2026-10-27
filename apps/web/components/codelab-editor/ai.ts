/**
 * Codelab chat: the request body and a pure reducer over the SSE events of
 * `docs/contracts/codelab-ai-events.md`. The reducer returns the chat panel state
 * plus effects for the editor (streamed text, written steps, new codelab.json).
 */

import { codelabSchema, type Codelab } from "@/lib/contracts/forge-design";
import type { CodelabStep } from "./model";

export type CodelabAction = "check_code" | "make_files";

export type CodelabMessageBody = {
  content: string;
  mode: "agent";
  target?: { stepId: string };
  action?: CodelabAction;
  action_input?: string | null;
};

export function messageBody(content: string, opts: { stepId?: string | null; action?: CodelabAction } = {}): CodelabMessageBody {
  const body: CodelabMessageBody = { content: content.trim(), mode: "agent" };
  if (opts.stepId) body.target = { stepId: opts.stepId };
  if (opts.action) body.action = opts.action;
  return body;
}

export type OutlineStep = { id: string; title: string; detail: string; minutes: number };
export type Outline = { runId: string; title: string; summary: string; steps: OutlineStep[] };
export type CheckIssue = { stepId: string | null; severity: "error" | "warning" | "info"; message: string; fix: string };
export type CheckReport = { summary: string; issues: CheckIssue[] };
export type ChatLine = { id: string; role: "user" | "assistant" | "error"; text: string };

export type ChatState = {
  lines: ChatLine[];
  outline: Outline | null;
  check: CheckReport | null;
  /** Step being written (id), with its title for the status line. */
  writing: { stepId: string; title: string } | null;
  runId: string | null;
  busy: boolean;
};

export const initialChat: ChatState = { lines: [], outline: null, check: null, writing: null, runId: null, busy: false };

export type EditorEffect =
  | { kind: "delta"; stepId: string; text: string }
  | { kind: "step"; step: CodelabStep; markdown: string }
  | { kind: "codelab"; codelab: Codelab }
  | { kind: "removed"; stepId: string }
  | { kind: "files" }
  | { kind: "done" };

const str = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

let lineSeq = 0;
export function line(role: ChatLine["role"], text: string): ChatLine {
  lineSeq += 1;
  return { id: `l${Date.now().toString(36)}${lineSeq}`, role, text };
}

/** Tasks of a `plan` event (or of `runs/active`) as outline steps. */
export function outlineSteps(tasks: unknown): OutlineStep[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter((task): task is Record<string, unknown> => !!task && typeof task === "object")
    .map((task) => ({
      id: str(task.id),
      title: str(task.title),
      detail: str(task.detail ?? task.idea),
      minutes: Math.max(0, Math.min(600, Math.round(num(task.minutes, 5)))),
    }))
    .filter((task) => task.id && task.title);
}

/** Body of `confirm-plan`: what the server reads (title, detail, minutes). */
export function confirmBody(steps: OutlineStep[]): { plan: Record<string, unknown>[] } {
  return { plan: steps.map((s) => ({ id: s.id, title: s.title.trim() || s.id, detail: s.detail, minutes: s.minutes, status: "pending" })) };
}

function checkReport(payload: Record<string, unknown>): CheckReport {
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  return {
    summary: str(payload.summary),
    issues: issues
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => ({
        stepId: typeof i.stepId === "string" ? i.stepId : null,
        severity: i.severity === "error" || i.severity === "warning" ? i.severity : "info",
        message: str(i.message),
        fix: str(i.fix),
      })),
  };
}

function parseStep(raw: unknown): CodelabStep | null {
  if (!raw || typeof raw !== "object") return null;
  const step = raw as Record<string, unknown>;
  if (!str(step.id) || !str(step.file)) return null;
  return { id: str(step.id), title: str(step.title) || undefined, file: str(step.file), minutes: num(step.minutes, 5) };
}

/** One SSE payload: the next chat state and what the editor must apply. */
export function reduceEvent(state: ChatState, payload: Record<string, unknown>): { state: ChatState; effects: EditorEffect[] } {
  const type = str(payload.type);
  const effects: EditorEffect[] = [];
  let next = state;
  switch (type) {
    case "codelab.outline": {
      const outline = (payload.outline ?? {}) as Record<string, unknown>;
      next = {
        ...state,
        runId: str(payload.run_id) || state.runId,
        outline: {
          runId: str(payload.run_id),
          title: str(outline.title),
          summary: str(outline.summary),
          steps: outlineSteps((outline.steps as unknown[]) ?? []),
        },
      };
      break;
    }
    case "plan": {
      if (payload.needs_confirm === true) {
        const meta = (payload.meta ?? {}) as Record<string, unknown>;
        const steps = outlineSteps(payload.tasks);
        next = {
          ...state,
          runId: str(payload.run_id) || state.runId,
          outline: {
            runId: str(payload.run_id) || state.outline?.runId || "",
            title: str(meta.title) || state.outline?.title || "",
            summary: str(meta.summary) || state.outline?.summary || "",
            steps: steps.length ? steps : state.outline?.steps ?? [],
          },
        };
      }
      break;
    }
    case "codelab.codelab": {
      const parsed = codelabSchema.safeParse(payload.codelab);
      if (parsed.success) effects.push({ kind: "codelab", codelab: parsed.data });
      break;
    }
    case "codelab.delta": {
      const stepId = str(payload.step_id);
      if (stepId) {
        effects.push({ kind: "delta", stepId, text: str(payload.text) });
        if (state.writing?.stepId !== stepId) next = { ...state, writing: { stepId, title: stepId } };
      }
      break;
    }
    case "codelab.step": {
      const step = parseStep(payload.step);
      if (step) {
        effects.push({ kind: "step", step, markdown: str(payload.markdown) });
        next = { ...state, writing: null };
      }
      break;
    }
    case "step": {
      // `task:<stepId>` while the outline is written: show its title.
      const id = str(payload.id ?? payload.step_id);
      if (id.startsWith("task:") && payload.status === "running") {
        const stepId = id.slice(5);
        const title = state.outline?.steps.find((s) => s.id === stepId)?.title || str(payload.label) || stepId;
        next = { ...state, writing: { stepId, title } };
      }
      break;
    }
    case "codelab.step_removed": {
      const stepId = str(payload.step_id);
      if (stepId) effects.push({ kind: "removed", stepId });
      break;
    }
    case "codelab.check":
      next = { ...state, check: checkReport(payload) };
      break;
    case "codelab.files": {
      const files = Array.isArray(payload.files) ? payload.files.length : 0;
      effects.push({ kind: "files" });
      next = { ...state, lines: [...state.lines, line("assistant", `files:${files}`)] };
      break;
    }
    case "error": {
      const message = str(payload.message) || str(payload.code) || "error";
      next = { ...state, busy: false, writing: null, lines: [...state.lines, line("error", message)] };
      break;
    }
    case "done": {
      const summary = str(payload.summary) || str(payload.message);
      next = {
        ...state,
        busy: false,
        writing: null,
        lines: summary ? [...state.lines, line("assistant", summary)] : state.lines,
      };
      effects.push({ kind: "done" });
      break;
    }
    default:
      break;
  }
  return { state: next, effects };
}

/** Apply a `delta` to the text streamed so far for a step (first delta replaces the saved text). */
export function appendDelta(streams: Record<string, string>, stepId: string, text: string): Record<string, string> {
  return { ...streams, [stepId]: (streams[stepId] ?? "") + text };
}
