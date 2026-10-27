import { describe, expect, it } from "vitest";
import type { SlideElement } from "@/lib/contracts/forge-design";
import { updateElement, updateSlide, type Doc } from "./model";
import { canRedo, canUndo, editorReducer, HISTORY_LIMIT, initialEditorState, type EditorState } from "./state";

const doc: Doc = {
  deck: {
    version: 1,
    format: { ratio: "16:9", width: 1920, height: 1080 },
    theme: { designSystem: "local", tokens: "DESIGN.md" },
    slides: [
      { id: "s1", layout: "title" },
      { id: "s2", layout: "text" },
    ],
  },
  slides: {
    s1: { id: "s1", elements: [{ id: "a", type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10 } as SlideElement] },
    s2: { id: "s2", elements: [] },
  },
};

const moveA = (dx: number) => (d: Doc) =>
  updateSlide(d, "s1", (s) => ({ ...s, elements: updateElement(s.elements, "a", (e) => ({ ...e, x: e.x + dx })) }));

const xOf = (state: EditorState) => state.doc!.slides.s1.elements[0].x;

function loaded(): EditorState {
  return editorReducer(initialEditorState(), { type: "load", doc });
}

describe("editor history", () => {
  it("loads and points at the first slide", () => {
    const state = loaded();
    expect(state.slideId).toBe("s1");
    expect(canUndo(state)).toBe(false);
  });

  it("undoes and redoes edits", () => {
    let state = loaded();
    state = editorReducer(state, { type: "edit", recipe: moveA(5), at: 1000 });
    state = editorReducer(state, { type: "edit", recipe: moveA(5), at: 5000 });
    expect(xOf(state)).toBe(10);
    state = editorReducer(state, { type: "undo" });
    expect(xOf(state)).toBe(5);
    state = editorReducer(state, { type: "undo" });
    expect(xOf(state)).toBe(0);
    expect(canUndo(state)).toBe(false);
    state = editorReducer(state, { type: "redo" });
    expect(xOf(state)).toBe(5);
    expect(canRedo(state)).toBe(true);
  });

  it("a new edit clears the redo stack", () => {
    let state = loaded();
    state = editorReducer(state, { type: "edit", recipe: moveA(5) });
    state = editorReducer(state, { type: "undo" });
    state = editorReducer(state, { type: "edit", recipe: moveA(1) });
    expect(canRedo(state)).toBe(false);
  });

  it("coalesces edits with the same key within a second", () => {
    let state = loaded();
    state = editorReducer(state, { type: "edit", recipe: moveA(1), key: "nudge", at: 1000 });
    state = editorReducer(state, { type: "edit", recipe: moveA(1), key: "nudge", at: 1500 });
    state = editorReducer(state, { type: "edit", recipe: moveA(1), key: "nudge", at: 1900 });
    expect(state.past).toHaveLength(1);
    state = editorReducer(state, { type: "edit", recipe: moveA(1), key: "nudge", at: 4000 });
    expect(state.past).toHaveLength(2);
    state = editorReducer(state, { type: "undo" });
    expect(xOf(state)).toBe(3);
  });

  it("records a whole gesture as one step", () => {
    let state = loaded();
    for (let i = 0; i < 10; i++) state = editorReducer(state, { type: "preview", recipe: moveA(2) });
    expect(xOf(state)).toBe(20);
    expect(state.past).toHaveLength(0);
    state = editorReducer(state, { type: "commit" });
    expect(state.past).toHaveLength(1);
    state = editorReducer(state, { type: "undo" });
    expect(xOf(state)).toBe(0);
  });

  it("cancels a gesture back to where it started", () => {
    let state = loaded();
    state = editorReducer(state, { type: "preview", recipe: moveA(50) });
    state = editorReducer(state, { type: "cancelGesture" });
    expect(xOf(state)).toBe(0);
    expect(state.past).toHaveLength(0);
  });

  it("records remote changes so an AI edit can be undone, or not when asked", () => {
    let state = loaded();
    state = editorReducer(state, { type: "remote", recipe: moveA(100) });
    expect(canUndo(state)).toBe(true);
    state = editorReducer(state, { type: "remote", recipe: moveA(1), record: false });
    expect(state.past).toHaveLength(1);
    expect(xOf(state)).toBe(101);
  });

  it("caps the history", () => {
    let state = loaded();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) state = editorReducer(state, { type: "edit", recipe: moveA(1) });
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it("drops selected ids that no longer exist after undo", () => {
    let state = loaded();
    state = editorReducer(state, { type: "select", ids: ["a"] });
    state = editorReducer(state, {
      type: "edit",
      recipe: (d) => updateSlide(d, "s1", (s) => ({ ...s, elements: [...s.elements, { id: "b", type: "shape", shape: "rect", x: 0, y: 0, w: 5, h: 5 }] })),
      select: ["b"],
    });
    expect(state.selection).toEqual(["b"]);
    state = editorReducer(state, { type: "undo" });
    expect(state.selection).toEqual([]);
  });

  it("toggles additive selection and focuses the deck", () => {
    let state = loaded();
    state = editorReducer(state, { type: "select", ids: ["a"] });
    expect(state.slideSelected).toBe(true);
    state = editorReducer(state, { type: "select", ids: ["a"], additive: true });
    expect(state.selection).toEqual([]);
    state = editorReducer(state, { type: "focusDeck" });
    expect(state.slideSelected).toBe(false);
  });
});
