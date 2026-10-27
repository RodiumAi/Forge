import { describe, expect, it } from "vitest";
import { confirmBody, initialChat, messageBody, outlineSteps, reduceEvent, type ChatState, type EditorEffect } from "./ai";

function run(events: Record<string, unknown>[], start: ChatState = initialChat) {
  let state = start;
  const effects: EditorEffect[] = [];
  for (const payload of events) {
    const out = reduceEvent(state, payload);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const codelab = {
  version: 1,
  title: "API",
  level: "beginner",
  durationMinutes: 7,
  steps: [{ id: "installer", title: "Installer", file: "steps/01-installer.md", minutes: 7 }],
};

describe("codelab chat events", () => {
  it("builds the request body with a step target or an action", () => {
    expect(messageBody(" Ajoute une route ", { stepId: "routes" })).toEqual({
      content: "Ajoute une route",
      mode: "agent",
      target: { stepId: "routes" },
    });
    expect(messageBody("Vérifier", { action: "check_code" })).toEqual({ content: "Vérifier", mode: "agent", action: "check_code" });
  });

  it("keeps the outline to confirm and sends title, detail and minutes back", () => {
    const { state } = run([
      {
        type: "codelab.outline",
        run_id: "r1",
        outline: { title: "API", summary: "S", steps: [{ id: "installer", title: "Installer", idea: "pip", minutes: 7 }] },
      },
      { type: "plan", run_id: "r1", tasks: [{ id: "installer", title: "Installer", detail: "pip", minutes: 7 }], meta: { title: "API" }, needs_confirm: true },
    ]);
    expect(state.outline?.runId).toBe("r1");
    expect(state.outline?.steps).toEqual([{ id: "installer", title: "Installer", detail: "pip", minutes: 7 }]);
    expect(confirmBody(state.outline!.steps).plan[0]).toMatchObject({ id: "installer", title: "Installer", minutes: 7 });
    expect(outlineSteps([{ id: "", title: "x" }, null, { id: "a", title: "A", minutes: 9999 }])).toEqual([
      { id: "a", title: "A", detail: "", minutes: 600 },
    ]);
  });

  it("turns writing events into editor effects", () => {
    const outlined = run([{ type: "plan", run_id: "r1", tasks: [{ id: "installer", title: "Installer" }], needs_confirm: true }]).state;
    const { state, effects } = run(
      [
        { type: "codelab.codelab", run_id: "r1", codelab },
        { type: "step", id: "task:installer", status: "running", label: "Installer" },
        { type: "codelab.delta", run_id: "r1", step_id: "installer", text: "# Ins" },
        { type: "codelab.delta", run_id: "r1", step_id: "installer", text: "taller" },
        {
          type: "codelab.step",
          run_id: "r1",
          step_id: "installer",
          step: { id: "installer", title: "Installer", file: "steps/01-installer.md", minutes: 7 },
          markdown: "# Installer\n",
        },
        { type: "codelab.step_removed", run_id: "r1", step_id: "intro" },
        { type: "codelab.files", run_id: "r1", files: ["files/starter/main.py"] },
        { type: "done", summary: "Fini" },
      ],
      outlined,
    );
    expect(effects.map((e) => e.kind)).toEqual(["codelab", "delta", "delta", "step", "removed", "files", "done"]);
    expect(effects[1]).toEqual({ kind: "delta", stepId: "installer", text: "# Ins" });
    expect(state.writing).toBeNull();
    expect(state.lines.map((l) => l.text)).toEqual(["files:1", "Fini"]);
  });

  it("shows the step title while writing and ignores an invalid codelab", () => {
    const outlined = run([{ type: "plan", run_id: "r1", tasks: [{ id: "installer", title: "Installer FastAPI" }], needs_confirm: true }]).state;
    const { state, effects } = run(
      [
        { type: "step", id: "task:installer", status: "running", label: "x" },
        { type: "codelab.codelab", codelab: { title: "" } },
      ],
      outlined,
    );
    expect(state.writing).toEqual({ stepId: "installer", title: "Installer FastAPI" });
    expect(effects).toEqual([]);
  });

  it("keeps the code review and reports errors", () => {
    const { state } = run([
      {
        type: "codelab.check",
        summary: "1 problème",
        issues: [{ stepId: "routes", severity: "error", message: "Import manquant", fix: "Ajouter import" }, { severity: "odd", message: "m" }],
      },
      { type: "error", code: "invalid_model_output" },
    ]);
    expect(state.check?.issues).toEqual([
      { stepId: "routes", severity: "error", message: "Import manquant", fix: "Ajouter import" },
      { stepId: null, severity: "info", message: "m", fix: "" },
    ]);
    expect(state.lines.at(-1)).toMatchObject({ role: "error", text: "invalid_model_output" });
  });
});
