/**
 * The twelve slide layouts, mirror of `apps/api/app/services/deck_ai/layouts.py`
 * (same names and boxes, drawn on 1920 x 1080 and scaled horizontally for 4:3
 * and 1:1). Used by "add slide" and the layout picker; the AI picks from the
 * same list, so a slide added here and one written by the AI line up.
 */

import { FORMAT_SIZES, type Deck, type Slide, type SlideElement } from "@/lib/contracts/forge-design";

export const LAYOUT_NAMES = [
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
] as const;
export type LayoutName = (typeof LAYOUT_NAMES)[number];

type Kind = "title" | "subtitle" | "body" | "image" | "number" | "quote" | "caption" | "chart" | "table" | "accent";
type LayoutBox = { id: string; kind: Kind; x: number; y: number; w: number; h: number; size?: number };

const BASE_WIDTH = 1920;

export const LAYOUT_BOXES: Record<LayoutName, LayoutBox[]> = {
  title: [
    { id: "title", kind: "title", x: 160, y: 360, w: 1600, h: 220, size: 104 },
    { id: "subtitle", kind: "subtitle", x: 160, y: 600, w: 1600, h: 100, size: 40 },
    { id: "accent", kind: "accent", x: 160, y: 320, w: 160, h: 8 },
  ],
  section: [
    { id: "number", kind: "number", x: 160, y: 300, w: 400, h: 160, size: 120 },
    { id: "title", kind: "title", x: 160, y: 480, w: 1600, h: 200, size: 88 },
  ],
  text: [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 72 },
    { id: "body", kind: "body", x: 120, y: 320, w: 1680, h: 640, size: 36 },
  ],
  "two-columns": [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 72 },
    { id: "left", kind: "body", x: 120, y: 320, w: 800, h: 640, size: 34 },
    { id: "right", kind: "body", x: 1000, y: 320, w: 800, h: 640, size: 34 },
  ],
  "image-text": [
    { id: "title", kind: "title", x: 120, y: 120, w: 820, h: 200, size: 64 },
    { id: "body", kind: "body", x: 120, y: 360, w: 820, h: 600, size: 34 },
    { id: "image", kind: "image", x: 1040, y: 0, w: 880, h: 1080 },
  ],
  quote: [
    { id: "quote", kind: "quote", x: 240, y: 300, w: 1440, h: 400, size: 64 },
    { id: "caption", kind: "caption", x: 240, y: 740, w: 1440, h: 80, size: 32 },
  ],
  "key-numbers": [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 64 },
    { id: "n1", kind: "number", x: 120, y: 380, w: 520, h: 200, size: 120 },
    { id: "n2", kind: "number", x: 700, y: 380, w: 520, h: 200, size: 120 },
    { id: "n3", kind: "number", x: 1280, y: 380, w: 520, h: 200, size: 120 },
    { id: "l1", kind: "caption", x: 120, y: 600, w: 520, h: 120, size: 30 },
    { id: "l2", kind: "caption", x: 700, y: 600, w: 520, h: 120, size: 30 },
    { id: "l3", kind: "caption", x: 1280, y: 600, w: 520, h: 120, size: 30 },
  ],
  chart: [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 64 },
    { id: "chart", kind: "chart", x: 120, y: 300, w: 1100, h: 680 },
    { id: "body", kind: "body", x: 1300, y: 300, w: 500, h: 680, size: 30 },
  ],
  table: [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 64 },
    { id: "table", kind: "table", x: 120, y: 300, w: 1680, h: 680, size: 28 },
  ],
  team: [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 64 },
    { id: "body", kind: "body", x: 120, y: 320, w: 1680, h: 640, size: 32 },
  ],
  timeline: [
    { id: "title", kind: "title", x: 120, y: 100, w: 1680, h: 160, size: 64 },
    { id: "line", kind: "accent", x: 120, y: 520, w: 1680, h: 6 },
    { id: "body", kind: "body", x: 120, y: 580, w: 1680, h: 400, size: 30 },
  ],
  thanks: [
    { id: "title", kind: "title", x: 160, y: 380, w: 1600, h: 200, size: 104 },
    { id: "subtitle", kind: "subtitle", x: 160, y: 600, w: 1600, h: 100, size: 36 },
  ],
};

export function isLayoutName(value: unknown): value is LayoutName {
  return typeof value === "string" && (LAYOUT_NAMES as readonly string[]).includes(value);
}

/** Layout boxes on the deck's canvas: x and w scale with the width, text shrinks on narrow formats. */
export function scaledBoxes(layout: LayoutName, ratio: Deck["format"]["ratio"]): LayoutBox[] {
  const width = FORMAT_SIZES[ratio]?.width ?? BASE_WIDTH;
  const sx = width / BASE_WIDTH;
  const textScale = sx >= 1 ? 1 : sx >= 0.7 ? 0.85 : 0.7;
  return LAYOUT_BOXES[layout].map((box) => ({
    ...box,
    x: Math.round(box.x * sx),
    w: Math.max(1, Math.round(box.w * sx)),
    size: box.size ? Math.round(box.size * textScale) : undefined,
  }));
}

/** Placeholder words of a new slide, in the editor's language. */
export type LayoutCopy = {
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  quote: string;
  caption: string;
  number: string;
  section: string;
  thanks: string;
  image: string;
  series: string;
  labels: string[];
  table: string[][];
};

const ROLE: Record<Kind, "title" | "subtitle" | "body" | "heading" | "quote" | "caption"> = {
  title: "title",
  subtitle: "subtitle",
  body: "body",
  number: "heading",
  quote: "quote",
  caption: "caption",
  image: "caption",
  chart: "caption",
  table: "caption",
  accent: "caption",
};

function textOf(layout: LayoutName, box: LayoutBox, copy: LayoutCopy): SlideElement {
  const base = { id: box.id, x: box.x, y: box.y, w: box.w, h: box.h };
  if (box.kind === "body") {
    return {
      ...base,
      type: "text",
      role: "body",
      content: [{ type: "bullet-list", items: copy.bullets.map((text) => ({ text })) }],
      style: { font: "body", size: box.size ?? 32, color: "--fg", align: "left" },
    };
  }
  const text =
    box.kind === "title"
      ? layout === "thanks"
        ? copy.thanks
        : layout === "section"
          ? copy.section
          : copy.title
      : box.kind === "subtitle"
        ? copy.subtitle
        : box.kind === "quote"
          ? copy.quote
          : box.kind === "number"
            ? layout === "section"
              ? "01"
              : copy.number
            : copy.caption;
  const display = box.kind === "title" || box.kind === "number" || box.kind === "quote";
  return {
    ...base,
    type: "text",
    role: ROLE[box.kind],
    content: [{ type: "paragraph", text }],
    style: {
      font: display ? "display" : "body",
      size: box.size ?? 32,
      weight: box.kind === "title" || box.kind === "number" ? 700 : 400,
      color: box.kind === "caption" || box.kind === "subtitle" ? "--muted" : box.kind === "number" ? "--accent" : "--fg",
      align: layout === "quote" || layout === "key-numbers" ? (box.kind === "title" ? "left" : "center") : "left",
    },
  };
}

/** A new slide drawn from a layout, with placeholder copy. */
export function slideFromLayout(id: string, layout: LayoutName, ratio: Deck["format"]["ratio"], copy: LayoutCopy): Slide {
  const elements: SlideElement[] = [];
  scaledBoxes(layout, ratio).forEach((box, index) => {
    const base = { id: box.id, x: box.x, y: box.y, w: box.w, h: box.h, z: index };
    if (box.kind === "accent") {
      elements.push({ ...base, type: "shape", shape: "rect", fill: "--accent" });
    } else if (box.kind === "image") {
      // A placeholder frame: "Fill with an image" turns it into an image element.
      elements.push({ ...base, type: "shape", shape: "rect", fill: "--surface", name: copy.image });
    } else if (box.kind === "chart") {
      elements.push({
        ...base,
        type: "chart",
        chart: "bar",
        data: { labels: copy.labels, series: [{ name: copy.series, values: copy.labels.map((_, i) => 20 + i * 15) }] },
        options: { legend: false, values: true },
      });
    } else if (box.kind === "table") {
      elements.push({
        ...base,
        type: "table",
        headerRow: true,
        rows: copy.table.map((row) => row.map((text) => ({ text }))),
        style: { size: box.size ?? 28 },
      });
    } else {
      elements.push({ ...textOf(layout, box, copy), z: index });
    }
  });
  return { id, background: { type: "color", token: "--bg" }, elements };
}
