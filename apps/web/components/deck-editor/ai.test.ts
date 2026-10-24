import { describe, expect, it } from "vitest";
import type { SlideElement } from "@/lib/contracts/forge-design";
import {
  applyDeckEvent,
  confirmPlanBody,
  messageBody,
  noticeFromWarning,
  parseDeckEvent,
  quickActionBody,
  targetFor,
  tasksFromPlan,
} from "./ai";
import type { Doc } from "./model";

const el = (id: string, x = 0): SlideElement => ({ id, type: "shape", shape: "rect", x, y: 0, w: 10, h: 10 });

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
  slides: { s1: { id: "s1", elements: [el("a")] }, s2: { id: "s2", elements: [el("local-edit", 55)] } },
};

describe("AI targets", () => {
  it("targets the deck when nothing is selected", () => {
    expect(targetFor({ slideId: "s1", slideSelected: false, selection: [] })).toBeUndefined();
    expect(messageBody("Make it blue")).toEqual({ content: "Make it blue", mode: "agent" });
  });

  it("targets the slide when the slide is selected", () => {
    const target = targetFor({ slideId: "s2", slideSelected: true, selection: [] });
    expect(target).toEqual({ slideId: "s2" });
    expect(messageBody("Plus clair", { target, model: "m1" })).toEqual({
      content: "Plus clair",
      mode: "agent",
      model: "m1",
      target: { slideId: "s2" },
    });
  });

  it("targets one element, and the slide for a multi-selection", () => {
    expect(targetFor({ slideId: "s1", slideSelected: true, selection: ["a"] })).toEqual({ slideId: "s1", elementId: "a" });
    expect(targetFor({ slideId: "s1", slideSelected: true, selection: ["a", "b"] })).toEqual({ slideId: "s1" });
  });

  it("lets the user force a deck-wide message", () => {
    expect(targetFor({ slideId: "s1", slideSelected: true, selection: ["a"], deckWide: true })).toBeUndefined();
  });
});

describe("quick actions", () => {
  it("sends the label as content and the action without input", () => {
    expect(quickActionBody("shorten", "Raccourcir", { slideId: "s2", elementId: "body" })).toEqual({
      content: "Raccourcir",
      mode: "agent",
      target: { slideId: "s2", elementId: "body" },
      action: "shorten",
    });
  });

  it("sends the layout for change_layout and the language for translate", () => {
    expect(quickActionBody("change_layout", "Changer la mise en page", { slideId: "s1" }, "two-columns")).toMatchObject({
      action: "change_layout",
      action_input: "two-columns",
    });
    expect(quickActionBody("translate", "Traduire", { slideId: "s1" }, "Spanish")).toMatchObject({ action: "translate", action_input: "Spanish" });
    expect(quickActionBody("translate", "Traduire", { slideId: "s1" }, "")).toMatchObject({ action_input: null });
    expect(quickActionBody("punchier", "Plus percutant", { slideId: "s1" }).action_input).toBeUndefined();
  });
});

describe("AI events", () => {
  it("replaces only the slide named by deck.slide", () => {
    const event = parseDeckEvent({
      type: "deck.slide",
      run_id: "r",
      slide_id: "s1",
      index: 0,
      total: 2,
      slide: { id: "s1", elements: [el("new", 300)] },
      notes: "Say hi",
      repaired: false,
      fallback: false,
    });
    expect(event?.type).toBe("deck.slide");
    const next = applyDeckEvent(doc, event!);
    expect(next.slides.s1.elements[0].id).toBe("new");
    expect(next.slides.s2).toBe(doc.slides.s2);
    expect(event?.type === "deck.slide" && event.notes).toBe("Say hi");
  });

  it("ignores an invalid slide", () => {
    expect(parseDeckEvent({ type: "deck.slide", slide_id: "s1", slide: { id: "s1", elements: [{ id: "x" }] } })).toBeNull();
  });

  it("replaces the deck and creates bodies for new slides, keeping known ones", () => {
    const event = parseDeckEvent({
      type: "deck.deck",
      deck: { ...doc.deck, slides: [{ id: "s2", layout: "text" }, { id: "s9", layout: "quote" }] },
    });
    const next = applyDeckEvent(doc, event!);
    expect(next.deck.slides.map((r) => r.id)).toEqual(["s2", "s9"]);
    expect(next.slides.s2).toBe(doc.slides.s2);
    expect(next.slides.s9).toEqual({ id: "s9", elements: [] });
    expect(next.slides.s1).toBeUndefined();
  });

  it("removes a slide", () => {
    const next = applyDeckEvent(doc, parseDeckEvent({ type: "deck.slide_removed", run_id: "r", slide_id: "s1" })!);
    expect(next.deck.slides.map((r) => r.id)).toEqual(["s2"]);
    expect(next.slides.s1).toBeUndefined();
  });

  it("turns SLIDE_FALLBACK and TARGET_SCOPE warnings into slide notices", () => {
    expect(
      noticeFromWarning({ type: "warning", message: "SLIDE_FALLBACK: s3", violation: { code: "SLIDE_FALLBACK", path: "slides/s3.json" } }),
    ).toEqual({ slideId: "s3", code: "SLIDE_FALLBACK", detail: undefined });
    expect(
      noticeFromWarning({ type: "warning", message: "TARGET_SCOPE: title, body", violation: { code: "TARGET_SCOPE", path: "slides/s2.json" } }),
    ).toEqual({ slideId: "s2", code: "TARGET_SCOPE", detail: "title, body" });
    expect(noticeFromWarning({ type: "warning", message: "something else" })).toBeNull();
  });
});

describe("outline confirm", () => {
  it("reads plan tasks and sends the edited outline", () => {
    const tasks = tasksFromPlan({
      type: "plan",
      tasks: [
        { id: "s1", title: "Intro", status: "pending", detail: "Hook", layout: "title", visual: false },
        { id: "s2", title: "Market", status: "pending", detail: "Size", layout: "key-numbers", visual: true },
      ],
    });
    expect(tasks).toHaveLength(2);
    const edited = [{ ...tasks[1], title: "Market size " }, { id: "new-1", title: "Thanks", detail: "", layout: "thanks", visual: false }, { ...tasks[0], title: " " }];
    expect(confirmPlanBody(edited)).toEqual({
      plan: [
        { id: "s2", title: "Market size", detail: "Size", layout: "key-numbers", visual: true, status: "pending" },
        { id: "new-1", title: "Thanks", detail: "", layout: "thanks", visual: false, status: "pending" },
      ],
    });
  });
});
