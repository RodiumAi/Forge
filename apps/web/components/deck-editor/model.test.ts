import { describe, expect, it } from "vitest";
import { slideSchema, type Slide, type SlideElement } from "@/lib/contracts/forge-design";
import {
  absoluteBox,
  copyElements,
  duplicateElements,
  duplicateSlide,
  findElement,
  groupElements,
  moveSlide,
  moveZ,
  placeZ,
  outermost,
  paintOrder,
  parseClipboard,
  pasteElements,
  removeElements,
  sameJson,
  ungroupElement,
  updateElement,
  type Doc,
} from "./model";

const rect = (id: string, x: number, y: number, w = 100, h = 100, extra: Partial<SlideElement> = {}): SlideElement =>
  ({ id, type: "shape", shape: "rect", x, y, w, h, ...extra }) as SlideElement;

const slide = (elements: SlideElement[]): Slide => ({ id: "s1", elements });

describe("groups use coordinates relative to the group", () => {
  it("groups siblings around their bounding box", () => {
    const s = groupElements(slide([rect("a", 100, 200), rect("b", 300, 250, 50, 50), rect("c", 0, 0)]), ["a", "b"], "g");
    expect(slideSchema.safeParse(s).success).toBe(true);
    const group = s.elements.find((e) => e.id === "g");
    expect(group).toMatchObject({ type: "group", x: 100, y: 200, w: 250, h: 100 });
    expect(group?.type === "group" && group.children.map((c) => [c.id, c.x, c.y])).toEqual([
      ["a", 0, 0],
      ["b", 200, 50],
    ]);
    expect(s.elements.map((e) => e.id)).toEqual(["g", "c"]);
  });

  it("keeps the absolute position of a child", () => {
    const s = groupElements(slide([rect("a", 100, 200), rect("b", 300, 250)]), ["a", "b"], "g");
    expect(absoluteBox(s, "b")).toMatchObject({ x: 300, y: 250 });
  });

  it("refuses elements from different parents", () => {
    const grouped = groupElements(slide([rect("a", 0, 0), rect("b", 10, 10), rect("c", 50, 50)]), ["a", "b"], "g");
    expect(groupElements(grouped, ["a", "c"], "g2")).toBe(grouped);
  });

  it("ungroups back to absolute coordinates (round trip)", () => {
    const original = slide([rect("a", 100, 200), rect("b", 300, 250, 50, 50)]);
    const back = ungroupElement(groupElements(original, ["a", "b"], "g"), "g");
    expect(back.elements.map((e) => [e.id, e.x, e.y])).toEqual([
      ["a", 100, 200],
      ["b", 300, 250],
    ]);
  });

  it("applies a rotated group's angle to its children when ungrouping", () => {
    const group: SlideElement = {
      id: "g",
      type: "group",
      x: 0,
      y: 0,
      w: 200,
      h: 100,
      rotation: 180,
      children: [rect("a", 0, 0, 100, 100)],
    };
    const back = ungroupElement(slide([group]), "g");
    expect(back.elements[0]).toMatchObject({ id: "a", x: 100, y: 0, rotation: 180 });
  });

  it("moving a group alone moves its children with it", () => {
    const s = groupElements(slide([rect("a", 100, 200), rect("b", 300, 250)]), ["a", "b"], "g");
    expect(outermost(s, ["g", "a"])).toEqual(["g"]);
    const moved = { ...s, elements: updateElement(s.elements, "g", (e) => ({ ...e, x: e.x + 10 })) };
    expect(absoluteBox(moved, "a")?.x).toBe(110);
  });
});

describe("tree edits", () => {
  it("removes nested elements and empty groups", () => {
    const s = groupElements(slide([rect("a", 0, 0), rect("b", 10, 10), rect("c", 50, 50)]), ["a", "b"], "g");
    const removed = removeElements(s.elements, new Set(["a", "b"]));
    expect(removed.map((e) => e.id)).toEqual(["c"]);
  });

  it("finds nested elements", () => {
    const s = groupElements(slide([rect("a", 0, 0), rect("b", 10, 10)]), ["a", "b"], "g");
    expect(findElement(s, "b")?.id).toBe("b");
  });
});

describe("stacking order", () => {
  const s = slide([rect("a", 0, 0, 10, 10, { z: 0 }), rect("b", 0, 0, 10, 10, { z: 1 }), rect("c", 0, 0, 10, 10, { z: 2 })]);
  const order = (els: SlideElement[]) => paintOrder(els).map((e) => e.id);

  it("brings forward and sends backward one step", () => {
    expect(order(moveZ(s.elements, ["a"], "forward"))).toEqual(["b", "a", "c"]);
    expect(order(moveZ(s.elements, ["c"], "backward"))).toEqual(["a", "c", "b"]);
  });

  it("brings to front and sends to back", () => {
    expect(order(moveZ(s.elements, ["a"], "front"))).toEqual(["b", "c", "a"]);
    expect(order(moveZ(s.elements, ["c"], "back"))).toEqual(["c", "a", "b"]);
  });

  it("places elements at a slot among the others, as a layer drag does", () => {
    expect(order(placeZ(s.elements, ["c"], 1))).toEqual(["a", "c", "b"]);
    expect(order(placeZ(s.elements, ["a", "b"], 1))).toEqual(["c", "a", "b"]);
    expect(order(placeZ(s.elements, ["a"], 99))).toEqual(["b", "c", "a"]);
    expect(placeZ(s.elements, ["a"], 0)).toBe(s.elements);
  });

  it("keeps the others in place when z values tie", () => {
    const tied = slide([rect("bar", 0, 0, 1, 1, { z: 2 }), rect("label", 0, 0, 1, 1, { z: 3 }), rect("title", 0, 0, 1, 1, { z: 3 }), rect("meta", 0, 0, 1, 1, { z: 3 })]);
    const once = placeZ(tied.elements, ["bar"], 3);
    expect(order(once)).toEqual(["label", "title", "meta", "bar"]);
    expect(order(moveZ(once, ["bar"], "back"))).toEqual(["bar", "label", "title", "meta"]);
  });
});

describe("duplicate, copy and paste", () => {
  it("duplicates with fresh ids and an offset", () => {
    const { slide: next, ids } = duplicateElements(slide([rect("a", 10, 10)]), ["a"]);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe("a");
    expect(findElement(next, ids[0])).toMatchObject({ x: 34, y: 34 });
    expect(slideSchema.safeParse(next).success).toBe(true);
  });

  it("copies grouped children as absolute elements and pastes them with new ids", () => {
    const s = groupElements(slide([rect("a", 100, 200), rect("b", 300, 250)]), ["a", "b"], "g");
    const payload = copyElements(s, ["b"]);
    expect(payload.elements[0]).toMatchObject({ id: "b", x: 300, y: 250 });
    const parsed = parseClipboard(JSON.stringify(payload));
    expect(parsed).not.toBeNull();
    const pasted = pasteElements({ id: "s2", elements: [] }, parsed!);
    expect(pasted.slide.elements[0]).toMatchObject({ x: 300, y: 250 });
    const again = pasteElements(s, parsed!);
    expect(new Set(again.ids).has("b")).toBe(false);
    expect(findElement(again.slide, again.ids[0])).toMatchObject({ x: 324, y: 274 });
    expect(slideSchema.safeParse(again.slide).success).toBe(true);
  });

  it("ignores foreign clipboard text", () => {
    expect(parseClipboard("hello")).toBeNull();
  });
});

describe("slides", () => {
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
    slides: { s1: { id: "s1", elements: [rect("a", 0, 0)] }, s2: { id: "s2", elements: [] } },
  };

  it("reorders slides", () => {
    expect(moveSlide(doc.deck, 0, 1).slides.map((r) => r.id)).toEqual(["s2", "s1"]);
  });

  it("duplicates a slide after the original", () => {
    const { doc: next, id } = duplicateSlide(doc, "s1");
    expect(next.deck.slides.map((r) => r.id)).toEqual(["s1", id, "s2"]);
    expect(next.slides[id].id).toBe(id);
    expect(sameJson(next.slides[id].elements, doc.slides.s1.elements)).toBe(true);
  });
});
