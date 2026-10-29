import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { slideSchema, type Deck, type Slide } from "@/lib/contracts/forge-design";
import type { Doc } from "./model";
import {
  importErrorKey,
  importSlides,
  insertionIndex,
  isPptxFile,
  parseHex,
  pickedSlides,
  selectAll,
  toDeckTheme,
  toggleSlide,
  warningTotals,
  type ImportedSlide,
} from "./slide-import";

function deckDoc(ids: string[]): Doc {
  const deck: Deck = {
    version: 1,
    title: "Deck",
    format: { ratio: "16:9", width: 1920, height: 1080 },
    theme: { designSystem: "local", tokens: "design-system.json" },
    slides: ids.map((id) => ({ id, layout: "text" })),
  };
  return { deck, slides: Object.fromEntries(ids.map((id) => [id, { id, elements: [] }])) };
}

function imported(index: number, slide: Partial<Slide> = {}, extra: Partial<ImportedSlide> = {}): ImportedSlide {
  return {
    index,
    title: `Slide ${index}`,
    hidden: false,
    slide: {
      id: `imported-${index}`,
      background: { type: "color", token: "#FFFFFF" },
      elements: [{ id: "title", type: "text", x: 100, y: 100, w: 800, h: 100, content: [{ type: "paragraph", text: `Title ${index}` }] }],
      ...slide,
    },
    notes: "",
    warnings: {},
    ...extra,
  };
}

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("selection", () => {
  const slides = [imported(1), imported(2), imported(3)];

  it("starts with everything and toggles one slide", () => {
    const all = selectAll(slides);
    expect([...all]).toEqual([1, 2, 3]);
    const without2 = toggleSlide(all, 2);
    expect([...without2].sort()).toEqual([1, 3]);
    expect(all.has(2)).toBe(true); // not mutated
    expect(toggleSlide(without2, 2).has(2)).toBe(true);
  });

  it("returns the picks in file order, whatever the click order", () => {
    const selection = toggleSlide(toggleSlide(new Set<number>(), 3), 1);
    expect(pickedSlides(slides, selection).map((s) => s.index)).toEqual([1, 3]);
    expect(pickedSlides(slides, new Set())).toEqual([]);
  });

  it("adds up the warnings of the picks", () => {
    const a = imported(1, {}, { warnings: { shape_approximated: 2 } });
    const b = imported(2, {}, { warnings: { shape_approximated: 1, chart_placeholder: 1, text_split: 0 } });
    expect(warningTotals([a, b])).toEqual([
      ["shape_approximated", 3],
      ["chart_placeholder", 1],
    ]);
  });

  it("recognises PowerPoint files", () => {
    expect(isPptxFile({ name: "Deck.PPTX", type: "" })).toBe(true);
    expect(isPptxFile({ name: "deck", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })).toBe(true);
    expect(isPptxFile({ name: "deck.ppt", type: "application/vnd.ms-powerpoint" })).toBe(false);
  });

  it("maps server errors to messages", () => {
    expect(importErrorKey(new ApiError("x", 413, "PPTX_TOO_LARGE"))).toBe("importErrorSize");
    expect(importErrorKey(new ApiError("x", 422, "PPTX_ENCRYPTED"))).toBe("importErrorEncrypted");
    expect(importErrorKey(new ApiError("x", 422, "PPTX_INVALID"))).toBe("importErrorInvalid");
    expect(importErrorKey(new ApiError("x", 422, "PPTX_TOO_COMPLEX"))).toBe("importErrorComplex");
    expect(importErrorKey(new ApiError("x", 429))).toBe("importErrorRate");
    expect(importErrorKey(new Error("boom"))).toBe("importErrorGeneric");
  });
});

describe("insertion", () => {
  it("goes after the current slide, or at the end", () => {
    const doc = deckDoc(["a", "b", "c"]);
    expect(insertionIndex(doc, "a")).toBe(1);
    expect(insertionIndex(doc, "c")).toBe(3);
    expect(insertionIndex(doc, null)).toBe(3);
    expect(insertionIndex(doc, "gone")).toBe(3);
  });

  it("inserts the picks in order with fresh ids, notes and hidden flags", () => {
    const doc = deckDoc(["a", "b"]);
    const picks = [imported(2, {}, { notes: "  First notes " }), imported(5, {}, { hidden: true })];
    const result = importSlides(doc, picks, 1, { keepTheme: true, random: seq(0.1, 0.2) });
    expect(result.ids).toHaveLength(2);
    expect(new Set(result.ids).size).toBe(2);
    for (const id of result.ids) expect(["a", "b", "imported-2", "imported-5"]).not.toContain(id);
    expect(result.doc.deck.slides.map((r) => r.id)).toEqual(["a", ...result.ids, "b"]);
    const [first, second] = result.ids;
    expect(result.doc.slides[first].id).toBe(first);
    expect(result.doc.slides[first].elements[0]).toMatchObject({ content: [{ text: "Title 2" }] });
    expect(result.doc.slides[second].elements[0]).toMatchObject({ content: [{ text: "Title 5" }] });
    expect(result.doc.deck.slides[1]).toEqual({ id: first, layout: "text" });
    expect(result.doc.deck.slides[2]).toEqual({ id: second, layout: "text", hidden: true });
    expect(result.notes).toEqual({ [first]: "First notes" });
    // The original document is left as it was (undo keeps it).
    expect(doc.deck.slides.map((r) => r.id)).toEqual(["a", "b"]);
    expect(Object.keys(doc.slides)).toEqual(["a", "b"]);
    // The source slides are copied, not shared.
    expect(result.doc.slides[first].elements).not.toBe(picks[0].slide.elements);
  });

  it("does not reuse an id taken by the deck, even with the same random draws", () => {
    const doc = deckDoc(["s-0000"]);
    const result = importSlides(doc, [imported(1), imported(2)], 0, { keepTheme: true, random: () => 0 });
    expect(result.ids).not.toContain("s-0000");
    expect(new Set(result.ids).size).toBe(2);
    expect(result.doc.deck.slides.map((r) => r.id)).toEqual([...result.ids, "s-0000"]);
  });

  it("skips a slide that breaks the contract", () => {
    const broken = imported(1, { elements: [{ id: "x", type: "shape", shape: "star" } as never] });
    const result = importSlides(deckDoc([]), [broken, imported(2)], 0, { keepTheme: true });
    expect(result.ids).toHaveLength(1);
    expect(result.doc.deck.slides).toHaveLength(1);
  });
});

describe("deck theme mapping", () => {
  const slide: Slide = {
    id: "x",
    background: { type: "color", token: "#FFFFFF" },
    elements: [
      { id: "band", type: "shape", shape: "rect", x: 0, y: 0, w: 1920, h: 200, z: 1, fill: "#1C1F26" },
      { id: "on-band", type: "text", x: 100, y: 50, w: 600, h: 100, z: 2, style: { color: "#FFFFFF", font: "display" }, content: [{ type: "paragraph", text: "Header" }] },
      {
        id: "body",
        type: "text",
        x: 100,
        y: 400,
        w: 800,
        h: 300,
        z: 3,
        style: { color: "#222222", size: 32 },
        content: [
          { type: "paragraph", runs: [{ text: "Plain " }, { text: "orange", color: "#EB6118", bold: true }, { text: " dark", color: "#222222" }] },
          { type: "bullet-list", items: [{ text: "item", runs: [{ text: "grey", color: "#AAAAAA" }] }] },
        ],
      },
      { id: "card", type: "shape", shape: "rect", x: 1000, y: 400, w: 400, h: 300, z: 4, fill: "#F4F4F4", stroke: "#DDDDDD" },
      { id: "dot", type: "shape", shape: "ellipse", x: 1500, y: 400, w: 100, h: 100, z: 5, fill: "#00000000" },
      { id: "rule", type: "shape", shape: "line", x: 100, y: 800, w: 800, h: 4, z: 6, stroke: "#333333" },
      {
        id: "table",
        type: "table",
        x: 100,
        y: 850,
        w: 800,
        h: 200,
        z: 7,
        rows: [[{ text: "A" }, { runs: [{ text: "B", color: "#EB6118" }] }]],
        style: { color: "#111111", headerFill: "#CCCCCC", border: "#999999" },
      },
      { id: "chart", type: "chart", chart: "bar", x: 1000, y: 800, w: 400, h: 200, z: 8, data: { labels: ["a"], series: [{ name: "s", values: [1], color: "#FF0000" }] } },
      {
        id: "group",
        type: "group",
        x: 1500,
        y: 900,
        w: 400,
        h: 100,
        z: 9,
        children: [{ id: "label", type: "text", x: 0, y: 0, w: 400, h: 100, style: { color: "#999999" }, content: [{ type: "paragraph", text: "small" }] }],
      },
    ],
  };
  const themed = toDeckTheme(slide);
  const byId = Object.fromEntries(themed.elements.map((el) => [el.id, el as Record<string, unknown>]));

  it("keeps the result a valid slide", () => {
    expect(slideSchema.safeParse(themed).success).toBe(true);
    expect(JSON.stringify(themed).match(/"#[0-9A-Fa-f]{3,8}"/g)).toEqual(['"#00000000"']);
  });

  it("maps the background and the blocks", () => {
    expect(themed.background).toEqual({ type: "color", token: "--bg" });
    expect(byId.band.fill).toBe("--fg");
    expect(byId.card).toMatchObject({ fill: "--surface", stroke: "--border" });
    // A transparent fill stays transparent.
    expect(byId.dot.fill).toBe("#00000000");
    expect(byId.rule.stroke).toBe("--fg");
  });

  it("maps text colours by contrast and colourfulness", () => {
    // White text on the dark band reads on the band: it takes the page colour.
    expect(byId["on-band"]).toMatchObject({ style: { color: "--bg", font: "display" } });
    const body = byId.body as { style: { color: string }; content: { runs?: { text: string; color?: string }[]; items?: { runs?: { color?: string }[] }[] }[] };
    expect(body.style.color).toBe("--fg");
    const runs = body.content[0].runs ?? [];
    expect(runs[1]).toEqual({ text: "orange", color: "--accent", bold: true });
    // Same colour as the box: the run colour goes away.
    expect(runs[2]).toEqual({ text: " dark" });
    expect(body.content[1].items?.[0].runs?.[0].color).toBe("--muted");
  });

  it("maps tables, charts and group children", () => {
    expect(byId.table).toMatchObject({ style: { color: "--fg", headerFill: "--surface", border: "--border" } });
    expect((byId.table.rows as { runs?: { color?: string }[] }[][])[0][1].runs?.[0].color).toBe("--accent");
    expect((byId.chart.data as { series: object[] }).series[0]).toEqual({ name: "s", values: [1] });
    expect((byId.group.children as { style: { color: string } }[])[0].style.color).toBe("--muted");
  });

  it("is applied by importSlides when the theme is not kept", () => {
    const result = importSlides(deckDoc([]), [imported(1, slide)], 0, { keepTheme: false });
    expect(result.doc.slides[result.ids[0]].background).toEqual({ type: "color", token: "--bg" });
    const kept = importSlides(deckDoc([]), [imported(1, slide)], 0, { keepTheme: true });
    expect(kept.doc.slides[kept.ids[0]].background).toEqual({ type: "color", token: "#FFFFFF" });
  });

  it("parses every hex form", () => {
    expect(parseHex("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseHex("#0000")?.a).toBe(0);
    expect(parseHex("#FF000080")?.a).toBeCloseTo(0.5, 2);
    expect(parseHex("--accent")).toBeNull();
  });
});
