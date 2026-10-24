import { describe, expect, it } from "vitest";
import { easingOf, elementMotion, slideStates, transitionBetween } from "./animations";
import { canvasSize, fitCanvas } from "./geometry";
import { highlightLine, parseHighlight } from "./highlight";
import { lucideIcon, pascalIconName } from "./icons";
import { isEditableTarget, mapKey, resolveKey } from "./keys";
import { matchMorph, morphedSourceIds } from "./morph";
import { channelName } from "./presenter-channel";
import { buildSchedule, isVisibleAtStep, nextPosition, previousPosition, stepCount } from "./steps";
import type { Slide, SlideElement } from "./types";

const el = (id: string, extra: Record<string, unknown> = {}): SlideElement =>
  ({ id, type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10, ...extra }) as SlideElement;

describe("geometry", () => {
  it("knows the three canvas sizes", () => {
    expect(canvasSize({ format: { ratio: "16:9", width: 1920, height: 1080 } })).toEqual({ width: 1920, height: 1080 });
    expect(canvasSize({ format: { ratio: "4:3", width: 1440, height: 1080 } })).toEqual({ width: 1440, height: 1080 });
    expect(canvasSize({ format: { ratio: "1:1", width: 1080, height: 1080 } })).toEqual({ width: 1080, height: 1080 });
    expect(canvasSize(null)).toEqual({ width: 1920, height: 1080 });
  });

  it("fits a 16:9 canvas in a wider container with side bands", () => {
    const fit = fitCanvas({ width: 2000, height: 900 }, { width: 1920, height: 1080 });
    expect(fit.scale).toBeCloseTo(900 / 1080);
    expect(fit.height).toBeCloseTo(900);
    expect(fit.width).toBeCloseTo(1600);
    expect(fit.left).toBeCloseTo(200);
    expect(fit.top).toBe(0);
  });

  it("fits a 1:1 canvas in a 16:9 container and a 4:3 canvas in a tall one", () => {
    const square = fitCanvas({ width: 1920, height: 1080 }, { width: 1080, height: 1080 });
    expect(square.scale).toBe(1);
    expect(square.left).toBe(420);
    const tall = fitCanvas({ width: 720, height: 1280 }, { width: 1440, height: 1080 });
    expect(tall.scale).toBe(0.5);
    expect(tall.top).toBe((1280 - 540) / 2);
    expect(tall.left).toBe(0);
  });

  it("returns a zero fit for an unmeasured container", () => {
    expect(fitCanvas({ width: 0, height: 0 }, { width: 1920, height: 1080 }).scale).toBe(0);
  });
});

describe("steps", () => {
  const slide: Pick<Slide, "elements"> = {
    elements: [
      el("static"),
      el("enter", { animation: { type: "appear", trigger: "on-enter", durationMs: 300 } }),
      el("c1", { animation: { type: "rise", trigger: "on-click", durationMs: 400 } }),
      el("after", { animation: { type: "pop", trigger: "after-previous", delayMs: 100, durationMs: 200 } }),
      el("c2", { animation: { type: "zoom", trigger: "on-click" } }),
      el("first", { animation: { type: "zoom", trigger: "on-click", order: 0 } }),
    ],
  };

  it("orders click steps by order then document order", () => {
    const schedule = buildSchedule(slide);
    expect(schedule.steps).toBe(3);
    expect(schedule.entries.get("first")?.step).toBe(1);
    expect(schedule.entries.get("c1")?.step).toBe(2);
    expect(schedule.entries.get("after")).toEqual({ step: 2, delayMs: 500, durationMs: 200 });
    expect(schedule.entries.get("c2")?.step).toBe(3);
    expect(schedule.entries.get("enter")?.step).toBe(0);
    expect(schedule.entries.has("static")).toBe(false);
  });

  it("chains after-previous on the arrival step", () => {
    const s = buildSchedule({
      elements: [
        el("a", { animation: { type: "appear", trigger: "on-enter", durationMs: 300 } }),
        el("b", { animation: { type: "appear", trigger: "after-previous", durationMs: 300 } }),
      ],
    });
    expect(s.steps).toBe(0);
    expect(s.entries.get("b")).toEqual({ step: 0, delayMs: 300, durationMs: 300 });
  });

  it("schedules group children and ignores hidden elements", () => {
    const s = buildSchedule({
      elements: [
        { ...el("g"), type: "group", children: [el("child", { animation: { type: "appear", trigger: "on-click" } })] } as SlideElement,
        el("gone", { hidden: true, animation: { type: "appear", trigger: "on-click" } }),
      ],
    });
    expect(s.steps).toBe(1);
    expect(s.entries.has("gone")).toBe(false);
  });

  it("shows elements up to the current step", () => {
    const schedule = buildSchedule(slide);
    expect(isVisibleAtStep(schedule, "static", 0)).toBe(true);
    expect(isVisibleAtStep(schedule, "c1", 1)).toBe(false);
    expect(isVisibleAtStep(schedule, "c1", 2)).toBe(true);
    expect(isVisibleAtStep(schedule, "c2", Infinity)).toBe(true);
  });

  it("consumes click steps before changing slide, both ways", () => {
    const steps = [2, 0, 1];
    const of = (i: number) => steps[i];
    let pos = { index: 0, step: 0 };
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      pos = nextPosition(pos, of, 3);
      seen.push(`${pos.index}.${pos.step}`);
    }
    expect(seen).toEqual(["0.1", "0.2", "1.0", "2.0", "2.1", "2.1"]);
    expect(previousPosition({ index: 2, step: 0 }, of)).toEqual({ index: 1, step: 0 });
    expect(previousPosition({ index: 1, step: 0 }, of)).toEqual({ index: 0, step: 2 });
    expect(previousPosition({ index: 0, step: 1 }, of)).toEqual({ index: 0, step: 0 });
    expect(previousPosition({ index: 0, step: 0 }, of)).toEqual({ index: 0, step: 0 });
    expect(stepCount(null)).toBe(0);
  });
});

describe("keys and remotes", () => {
  it.each([
    ["ArrowRight", "next"],
    ["ArrowDown", "next"],
    ["PageDown", "next"],
    [" ", "next"],
    ["n", "next"],
    ["N", "next"],
    ["ArrowLeft", "prev"],
    ["ArrowUp", "prev"],
    ["PageUp", "prev"],
    ["p", "prev"],
    ["P", "prev"],
    ["Home", "first"],
    ["End", "last"],
    ["Escape", "exit"],
    ["b", "black"],
    ["B", "black"],
    [".", "black"],
    ["w", "white"],
    ["W", "white"],
    [",", "white"],
    ["Enter", "enter"],
    ["Backspace", "backspace"],
  ])("maps %j to %s", (key, type) => {
    expect(mapKey({ key })?.type).toBe(type);
  });

  it("maps F5 and Shift+F5", () => {
    expect(mapKey({ key: "F5" })).toEqual({ type: "start", fromCurrent: false });
    expect(mapKey({ key: "F5", shiftKey: true })).toEqual({ type: "start", fromCurrent: true });
  });

  it("ignores modified keys and unknown keys", () => {
    expect(mapKey({ key: "ArrowRight", ctrlKey: true })).toBeNull();
    expect(mapKey({ key: "r", metaKey: true })).toBeNull();
    expect(mapKey({ key: "x" })).toBeNull();
  });

  it("types a slide number then Enter", () => {
    let buffer = "";
    for (const key of ["1", "2"]) {
      const step = resolveKey(mapKey({ key })!, buffer);
      buffer = step.buffer;
      expect(step.result.kind).toBe("buffer");
    }
    const corrected = resolveKey(mapKey({ key: "Backspace" })!, buffer);
    expect(corrected.buffer).toBe("1");
    const go = resolveKey(mapKey({ key: "Enter" })!, corrected.buffer);
    expect(go.result).toEqual({ kind: "goto", slide: 1 });
    expect(go.buffer).toBe("");
  });

  it("treats Enter and Backspace as next and previous without digits", () => {
    expect(resolveKey({ type: "enter" }, "").result).toEqual({ kind: "action", action: { type: "next" } });
    expect(resolveKey({ type: "backspace" }, "").result).toEqual({ kind: "action", action: { type: "prev" } });
    expect(resolveKey({ type: "black" }, "12")).toEqual({ result: { kind: "action", action: { type: "black" } }, buffer: "" });
  });

  it("leaves typing in fields to the page", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("morph", () => {
  const prev = {
    elements: [
      el("a", { matchKey: "k", x: 10, y: 20, w: 30, h: 40, rotation: 5 }),
      el("b", { matchKey: "only-prev" }),
      el("c", { matchKey: "hid", hidden: true }),
    ],
  };
  const next = { elements: [el("a2", { matchKey: "k", x: 100 }), el("x"), el("c2", { matchKey: "hid" }), el("dup", { matchKey: "k" })] };

  it("matches elements by matchKey, first one wins", () => {
    const map = matchMorph(prev, next);
    expect([...map.keys()]).toEqual(["a2"]);
    expect(map.get("a2")).toEqual({ x: 10, y: 20, w: 30, h: 40, rotation: 5, opacity: 1 });
  });

  it("lists the sources to hide on the leaving slide", () => {
    expect([...morphedSourceIds(prev, next)]).toEqual(["a"]);
    expect(matchMorph(null, next).size).toBe(0);
  });
});

describe("transitions and animations", () => {
  const refs = [{ transition: { type: "fade" as const } }, { transition: { type: "push" as const, direction: "left" as const } }, {}];

  it("plays the arriving slide transition forward and the leaving one backward", () => {
    expect(transitionBetween(refs, 0, 1)).toEqual({ transition: { type: "push", direction: "left" }, dir: 1 });
    expect(transitionBetween(refs, 1, 0)).toEqual({ transition: { type: "push", direction: "left" }, dir: -1 });
    expect(transitionBetween(refs, 1, 2).transition.type).toBe("none");
  });

  it("pushes from the right going forward and from the left going back", () => {
    const fwd = slideStates({ transition: { type: "push", direction: "left" }, dir: 1 });
    expect(fwd.enter.x).toBe("100%");
    expect(fwd.exit.x).toBe("-100%");
    const back = slideStates({ transition: { type: "push", direction: "left" }, dir: -1 });
    expect(back.enter.x).toBe("-100%");
    const up = slideStates({ transition: { type: "push", direction: "up" }, dir: 1 });
    expect(up.enter.y).toBe("100%");
  });

  it("covers the whole transition catalogue", () => {
    for (const type of ["none", "fade", "push", "slide", "wipe", "zoom-in", "zoom-out", "dissolve", "curtain", "cube", "morph"] as const) {
      const s = slideStates({ transition: { type }, dir: 1 });
      expect(s.enter).toBeTruthy();
      expect(s.center.zIndex).toBe(2);
    }
  });

  it("has a hidden and visible state for every element animation", () => {
    for (const type of ["appear", "rise", "drop", "slide", "pop", "zoom", "typewriter", "mask-reveal", "bounce", "pulse"] as const) {
      const m = elementMotion({ type });
      expect(m.hidden).not.toEqual(m.visible);
    }
    expect(elementMotion({ type: "mask-reveal", direction: "up" }).hidden.clipPath).toBe("inset(0% 0% 100% 0%)");
    expect(easingOf("linear")).toBe("linear");
  });
});

describe("helpers", () => {
  it("highlights comments, strings, numbers and keywords", () => {
    const tokens = highlightLine("const x = 'a' + 42 // done", "ts");
    expect(tokens.map((t) => t.kind)).toEqual(["keyword", "plain", "string", "plain", "number", "plain", "comment"]);
    expect(highlightLine("x = 1  # c", "python").at(-1)).toEqual({ kind: "comment", text: "# c" });
    expect([...parseHighlight("1,3-5")]).toEqual([1, 3, 4, 5]);
  });

  it("finds lucide icons by kebab case name", () => {
    expect(pascalIconName("trending-up")).toBe("TrendingUp");
    expect(lucideIcon("star")).toBeTruthy();
    expect(lucideIcon("no-such-icon-name")).toBeNull();
  });

  it("derives a stable channel name", () => {
    const deck = { title: "A", slides: [{ id: "s1", layout: "title" }] };
    expect(channelName(deck)).toBe(channelName({ ...deck }));
    expect(channelName(deck)).not.toBe(channelName({ ...deck, title: "B" }));
  });
});
