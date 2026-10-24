import { describe, expect, it } from "vitest";
import { DECK_RATIOS, FORMAT_SIZES, slideSchema } from "@/lib/contracts/forge-design";
import { LAYOUT_NAMES, scaledBoxes, slideFromLayout } from "./layouts";
import { applyPreset, applyTransitionToAll } from "./presets";
import { deckSchema } from "@/lib/contracts/forge-design";
import type { Doc } from "./model";
import { copyFor } from "./strings";

describe("layouts", () => {
  it("lists the twelve layouts of the slides AI", () => {
    expect(LAYOUT_NAMES).toEqual([
      "title",
      "section",
      "text",
      "two-columns",
      "image-text",
      "quote",
      "key-numbers",
      "chart",
      "table",
      "team",
      "timeline",
      "thanks",
    ]);
  });

  it("builds a valid slide for every layout and format, inside the canvas", () => {
    for (const ratio of DECK_RATIOS) {
      for (const layout of LAYOUT_NAMES) {
        const slide = slideFromLayout("s9", layout, ratio, copyFor("fr"));
        const parsed = slideSchema.safeParse(slide);
        expect(parsed.success, `${layout} ${ratio}`).toBe(true);
        for (const element of slide.elements) {
          expect(element.x + element.w).toBeLessThanOrEqual(FORMAT_SIZES[ratio].width);
        }
      }
    }
  });

  it("scales boxes horizontally for 4:3", () => {
    const [title] = scaledBoxes("text", "4:3");
    expect(title).toMatchObject({ x: 90, w: 1260, y: 100, h: 160 });
  });
});

describe("presets", () => {
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
    slides: { s1: slideFromLayout("s1", "title", "16:9", copyFor("en")), s2: slideFromLayout("s2", "text", "16:9", copyFor("en")) },
  };

  it.each(["sober", "dynamic", "elegant"] as const)("%s keeps the deck and slides valid", (preset) => {
    const next = applyPreset(doc, preset);
    expect(deckSchema.safeParse(next.deck).success).toBe(true);
    for (const ref of next.deck.slides) expect(slideSchema.safeParse(next.slides[ref.id]).success).toBe(true);
  });

  it("sets the transitions of each preset", () => {
    expect(applyPreset(doc, "sober").deck.slides.every((r) => r.transition?.type === "fade")).toBe(true);
    expect(applyPreset(doc, "dynamic").deck.slides[0].transition).toMatchObject({ type: "push", direction: "left" });
    const elegant = applyPreset(doc, "elegant");
    expect(elegant.deck.slides[1].transition?.type).toBe("morph");
    expect(elegant.slides.s1.elements.find((e) => e.id === "title")?.matchKey).toBe("title");
  });

  it("applies one transition to every slide", () => {
    const next = applyTransitionToAll(doc, { type: "wipe", direction: "up" });
    expect(next.deck.slides.map((r) => r.transition)).toEqual([
      { type: "wipe", direction: "up" },
      { type: "wipe", direction: "up" },
    ]);
  });
});
