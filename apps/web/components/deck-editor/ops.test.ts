import { describe, expect, it } from "vitest";
import { slideSchema, type Deck, type Slide, type SlideElement } from "@/lib/contracts/forge-design";
import { closestAspect } from "./DeckImagePanel";
import { imagePaths, toPicked } from "./images-client";
import { findElement, groupElements, scaleChildren, type Doc } from "./model";
import { align, fillWithImage, insertElement, moveBy, newElement, newImageElement, setStyle, setStyleOnRole, type InsertKind } from "./ops";
import { presentIndex } from "./PresentOverlay";

const deck: Deck = {
  version: 1,
  format: { ratio: "16:9", width: 1920, height: 1080 },
  theme: { designSystem: "local", tokens: "DESIGN.md" },
  slides: [
    { id: "s1", layout: "title" },
    { id: "s2", layout: "text", hidden: true },
    { id: "s3", layout: "text" },
  ],
};

const rect = (id: string, x: number, y: number, extra: Partial<SlideElement> = {}): SlideElement =>
  ({ id, type: "shape", shape: "rect", x, y, w: 100, h: 100, ...extra }) as SlideElement;

const doc = (elements: SlideElement[]): Doc => ({ deck, slides: { s1: { id: "s1", elements }, s2: { id: "s2", elements: [] }, s3: { id: "s3", elements: [] } } });

describe("insertion", () => {
  it.each(["text", "rect", "ellipse", "line", "arrow", "icon", "table", "chart", "code", "video"] as InsertKind[])("inserts a valid %s centered on top", (kind) => {
    const base = doc([rect("a", 0, 0, { z: 3 })]);
    const element = newElement(kind, base.slides.s1, deck, { text: "Texte", series: "Série" });
    const next = insertElement("s1", element)(base);
    expect(slideSchema.safeParse(next.slides.s1).success).toBe(true);
    expect(element.z).toBe(4);
    expect(element.x + element.w / 2).toBeCloseTo(960, -1);
  });

  it("fits a new image inside the slide with its ratio", () => {
    const el = newImageElement({ id: "s1", elements: [] }, deck, { path: "public/images/a.webp", width: 1000, height: 2000 });
    expect(el.h).toBeLessThanOrEqual(1080 * 0.8 + 1);
    expect(el.w / el.h).toBeCloseTo(0.5, 2);
  });

  it("fills a placeholder shape with an image, keeping its box", () => {
    const next = fillWithImage("s1", "ph", { path: "public/images/p.webp", credit: { source: "pixabay", author: "Jo" } }, "Une plage")(doc([rect("ph", 10, 20, { z: 2, rotation: 5 })]));
    expect(findElement(next.slides.s1, "ph")).toMatchObject({ type: "image", x: 10, y: 20, z: 2, rotation: 5, src: "public/images/p.webp", alt: "Une plage", credit: { source: "pixabay", author: "Jo" } });
    expect(slideSchema.safeParse(next.slides.s1).success).toBe(true);
  });
});

describe("editing commands", () => {
  it("does not move locked elements", () => {
    const base = doc([rect("a", 0, 0), rect("b", 0, 0, { locked: true })]);
    const next = moveBy("s1", ["a", "b"], 5, 5, base.slides.s1)(base);
    expect(findElement(next.slides.s1, "a")).toMatchObject({ x: 5, y: 5 });
    expect(findElement(next.slides.s1, "b")).toMatchObject({ x: 0, y: 0 });
  });

  it("aligns one element to the slide and several to their bounds", () => {
    const base = doc([rect("a", 10, 10), rect("b", 500, 300)]);
    const one = align("s1", base.slides.s1, deck, ["a"], "hcenter")(base);
    expect(findElement(one.slides.s1, "a")?.x).toBe(910);
    const two = align("s1", base.slides.s1, deck, ["a", "b"], "bottom")(base);
    expect(findElement(two.slides.s1, "a")?.y).toBe(300);
  });

  it("merges text styles and removes cleared fields", () => {
    const text: SlideElement = { id: "t", type: "text", x: 0, y: 0, w: 10, h: 10, content: [], style: { size: 40, italic: true } };
    const next = setStyle("s1", ["t"], { italic: false, align: "center" })(doc([text]));
    expect(findElement(next.slides.s1, "t")).toMatchObject({ style: { size: 40, align: "center" } });
    expect((findElement(next.slides.s1, "t") as { style: Record<string, unknown> }).style.italic).toBeUndefined();
  });

  it("scales a group's children with the group, text sizes from corners only", () => {
    const text: SlideElement = { id: "t", type: "text", x: 100, y: 50, w: 200, h: 100, content: [], style: { size: 40 } };
    const slide: Slide = groupElements({ id: "s1", elements: [rect("a", 0, 0), text] }, ["a", "t"], "g");
    const group = slide.elements[0];
    if (group.type !== "group") throw new Error("group expected");
    const twice = scaleChildren(group.children, 2, 2, 2);
    expect(twice[1]).toMatchObject({ x: 200, y: 100, w: 400, h: 200, style: { size: 80 } });
    const wide = scaleChildren(group.children, 2, 1, 1);
    expect(wide[1]).toMatchObject({ x: 200, y: 50, w: 400, h: 100, style: { size: 40 } });
  });
});

describe("helpers", () => {
  it("starts presenting at the current slide among visible ones", () => {
    expect(presentIndex(deck, "s1")).toBe(0);
    expect(presentIndex(deck, "s2")).toBe(1);
    expect(presentIndex(deck, "s3")).toBe(1);
    expect(presentIndex(deck, null)).toBe(0);
  });

  it("lists project images without their size variants", () => {
    const tree = [
      {
        path: "public",
        type: "dir",
        children: [
          {
            path: "public/images",
            type: "dir",
            children: [
              { path: "public/images/a.webp", type: "file" },
              { path: "public/images/a-640.webp", type: "file" },
              { path: "public/images/__visual__.webp", type: "file" },
              { path: "public/images/photo-2024.png", type: "file" },
            ],
          },
        ],
      },
      { path: "deck.json", type: "file" },
    ];
    expect(imagePaths(tree)).toEqual(["public/images/a.webp", "public/images/photo-2024.png"]);
  });

  it("maps API credits to the slide contract", () => {
    expect(toPicked({ path: "public/images/x.webp", public_path: "/images/x.webp", width: 10, height: 5, credit: { source: "pixabay", author: "Ann", pageUrl: "https://pixabay.com/p/1" } }, "beach")).toEqual({
      path: "public/images/x.webp",
      width: 10,
      height: 5,
      alt: "beach",
      credit: { source: "pixabay", author: "Ann", url: "https://pixabay.com/p/1" },
    });
    expect(toPicked({ path: "p", public_path: "/p", width: 1, height: 1, credit: { source: "weird" } }).credit).toBeUndefined();
  });

  it("offers the AI format closest to the frame", () => {
    expect(closestAspect(1920, 1080)).toBe("16:9");
    expect(closestAspect(880, 1080)).toBe("3:4");
    expect(closestAspect(500, 500)).toBe("1:1");
  });
});

describe("font by role", () => {
  const text = (id: string, role?: string): SlideElement =>
    ({ id, type: "text", x: 0, y: 0, w: 100, h: 40, content: [{ type: "paragraph", text: id }], ...(role ? { role } : {}) }) as SlideElement;

  it("styles every text of the role on every slide, groups included, no role counting as body", () => {
    const base: Doc = {
      deck,
      slides: {
        s1: { id: "s1", elements: [text("t1", "title"), text("b1", "body"), text("n1")] },
        s2: { id: "s2", elements: [{ id: "g", type: "group", x: 0, y: 0, w: 100, h: 100, children: [text("b2", "body")] } as SlideElement] },
        s3: { id: "s3", elements: [text("t3", "title")] },
      },
    };
    const next = setStyleOnRole(["s1", "s2", "s3"], "body", { family: "Inter" })(base);
    const family = (slide: string, id: string) => (findElement(next.slides[slide], id) as { style?: { family?: string } }).style?.family;
    expect(family("s1", "b1")).toBe("Inter");
    expect(family("s1", "n1")).toBe("Inter");
    expect(family("s2", "b2")).toBe("Inter");
    expect(family("s1", "t1")).toBeUndefined();
    expect(family("s3", "t3")).toBeUndefined();
    expect(next.slides.s3).toBe(base.slides.s3);
  });
});
