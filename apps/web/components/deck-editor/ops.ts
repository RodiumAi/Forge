/**
 * Editor commands as document recipes: `(doc) => doc`, ready for the
 * reducer's `edit` action. They work on the current slide and selection.
 */

import { canvasSize } from "@/components/deck-player";
import type { Slide, SlideElement } from "@/lib/contracts/forge-design";
import { aabb, alignDeltas, distributeDeltas, type Align, type Rect, unionRect } from "./geometry";
import {
  allElementIds,
  absoluteBox,
  freshId,
  groupElements,
  locate,
  moveZ,
  placeZ,
  outermost,
  removeElements,
  ungroupElement,
  updateElement,
  updateSlide,
  type Doc,
  type ZMove,
} from "./model";

export type Recipe = (doc: Doc) => Doc;

function onSlide(slideId: string, fn: (slide: Slide) => Slide): Recipe {
  return (doc) => updateSlide(doc, slideId, fn);
}

/** Change elements (any depth) with a function; locked elements included. */
export function patchElements(slideId: string, ids: string[], fn: (el: SlideElement) => SlideElement): Recipe {
  return onSlide(slideId, (slide) => {
    let elements = slide.elements;
    for (const id of ids) elements = updateElement(elements, id, fn);
    return elements === slide.elements ? slide : { ...slide, elements };
  });
}

/** Set fields on elements; `undefined` removes the field. */
export function setFields(slideId: string, ids: string[], fields: Record<string, unknown>): Recipe {
  return patchElements(slideId, ids, (el) => {
    const next = { ...el } as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return next as SlideElement;
  });
}

/** Merge into the `style` object of text (or table) elements. */
export function setStyle(slideId: string, ids: string[], style: Record<string, unknown>): Recipe {
  return patchElements(slideId, ids, (el) => {
    if (el.type !== "text" && el.type !== "table") return el;
    const next = { ...(el.style ?? {}) } as Record<string, unknown>;
    for (const [key, value] of Object.entries(style)) {
      if (value === undefined || value === false) delete next[key];
      else next[key] = value;
    }
    const out = { ...el, style: next } as SlideElement & { style?: Record<string, unknown> };
    if (Object.keys(next).length === 0) delete out.style;
    return out as SlideElement;
  });
}

/** `setStyle` on every text and table of the given slides (any depth). */
export function setStyleOnSlides(slideIds: string[], style: Record<string, unknown>): Recipe {
  return (doc) =>
    slideIds.reduce((current, id) => {
      const slide = current.slides[id];
      return slide ? setStyle(id, [...allElementIds(slide.elements)], style)(current) : current;
    }, doc);
}

/** Texts of a role (no role counts as body), in groups too. */
function textIdsWithRole(elements: SlideElement[], role: string, out: string[] = []): string[] {
  for (const element of elements) {
    if (element.type === "text" && (element.role ?? "body") === role) out.push(element.id);
    if (element.type === "group") textIdsWithRole(element.children, role, out);
  }
  return out;
}

/** Same style on every text of one role, on each listed slide. */
export function setStyleOnRole(slideIds: string[], role: string, style: Record<string, unknown>): Recipe {
  return (doc) =>
    slideIds.reduce((current, id) => {
      const slide = current.slides[id];
      const ids = slide ? textIdsWithRole(slide.elements, role) : [];
      return ids.length ? setStyle(id, ids, style)(current) : current;
    }, doc);
}

export function moveBy(slideId: string, ids: string[], dx: number, dy: number, slide: Slide): Recipe {
  const movable = outermost(slide, ids).filter((id) => !locate(slide.elements, id)?.element.locked);
  return patchElements(slideId, movable, (el) => ({ ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) }));
}

export function deleteElements(slideId: string, ids: string[]): Recipe {
  return onSlide(slideId, (slide) => {
    const elements = removeElements(slide.elements, new Set(ids));
    return elements === slide.elements ? slide : { ...slide, elements };
  });
}

export function zOrder(slideId: string, ids: string[], move: ZMove): Recipe {
  return onSlide(slideId, (slide) => {
    const elements = moveZ(slide.elements, ids, move);
    return elements === slide.elements ? slide : { ...slide, elements };
  });
}

/** Move sibling elements to a stacking slot (see `placeZ`). */
export function placeLayers(slideId: string, ids: string[], slot: number): Recipe {
  return onSlide(slideId, (slide) => {
    const elements = placeZ(slide.elements, ids, slot);
    return elements === slide.elements ? slide : { ...slide, elements };
  });
}

export function group(slideId: string, ids: string[], groupId: string): Recipe {
  return onSlide(slideId, (slide) => groupElements(slide, outermost(slide, ids), groupId));
}

export function ungroup(slideId: string, groupId: string): Recipe {
  return onSlide(slideId, (slide) => ungroupElement(slide, groupId));
}

/**
 * Align the selection: to the slide when one element is selected, to the
 * selection bounds otherwise. Works in each element's parent space.
 */
export function align(slideId: string, slide: Slide, deck: Doc["deck"], ids: string[], how: Align): Recipe {
  const items = outermost(slide, ids)
    .map((id) => {
      const box = absoluteBox(slide, id);
      return box ? { id, rect: aabb(box) } : null;
    })
    .filter((x): x is { id: string; rect: Rect } => !!x);
  if (!items.length) return (doc) => doc;
  const size = canvasSize(deck);
  const reference = items.length === 1 ? { x: 0, y: 0, w: size.width, h: size.height } : unionRect(items.map((i) => i.rect))!;
  const deltas = alignDeltas(items, reference, how);
  return patchElements(slideId, Object.keys(deltas), (el) => ({ ...el, x: el.x + deltas[el.id].x, y: el.y + deltas[el.id].y }));
}

export function distribute(slideId: string, slide: Slide, ids: string[], axis: "x" | "y"): Recipe {
  const items = outermost(slide, ids)
    .map((id) => {
      const box = absoluteBox(slide, id);
      return box ? { id, rect: aabb(box) } : null;
    })
    .filter((x): x is { id: string; rect: Rect } => !!x);
  const deltas = distributeDeltas(items, axis);
  return patchElements(slideId, Object.keys(deltas), (el) => ({ ...el, x: el.x + deltas[el.id].x, y: el.y + deltas[el.id].y }));
}

// ── insertion ───────────────────────────────────────────────────────────────

export type InsertKind = "text" | "rect" | "ellipse" | "line" | "arrow" | "icon" | "table" | "chart" | "code" | "video";

/** A new element centered on the slide, on top of the others. */
export function newElement(kind: InsertKind, slide: Slide, deck: Doc["deck"], labels: { text: string; series: string }): SlideElement {
  const size = canvasSize(deck);
  const taken = allElementIds(slide.elements);
  const z = Math.max(0, ...slide.elements.map((e) => e.z ?? 0)) + 1;
  const place = (w: number, h: number) => ({ x: Math.round((size.width - w) / 2), y: Math.round((size.height - h) / 2), w, h, z });
  switch (kind) {
    case "text":
      return {
        id: freshId("text", taken),
        type: "text",
        role: "body",
        ...place(Math.min(900, size.width - 160), 120),
        content: [{ type: "paragraph", text: labels.text }],
        style: { font: "body", size: 40, color: "--fg", align: "left" },
      };
    case "rect":
    case "ellipse":
      return { id: freshId(kind, taken), type: "shape", shape: kind, ...place(400, 300), fill: "--accent" };
    case "line":
    case "arrow":
      return { id: freshId(kind, taken), type: "shape", shape: kind, ...place(500, 40), stroke: "--fg", strokeWidth: 6 };
    case "icon":
      return { id: freshId("icon", taken), type: "icon", icon: "star", ...place(160, 160), color: "--accent" };
    case "table":
      return {
        id: freshId("table", taken),
        type: "table",
        headerRow: true,
        ...place(1000, 360),
        rows: [
          [{ text: "A" }, { text: "B" }, { text: "C" }],
          [{ text: "1" }, { text: "2" }, { text: "3" }],
          [{ text: "4" }, { text: "5" }, { text: "6" }],
        ],
        style: { size: 28 },
      };
    case "chart":
      return {
        id: freshId("chart", taken),
        type: "chart",
        chart: "bar",
        ...place(900, 560),
        data: { labels: ["A", "B", "C"], series: [{ name: labels.series, values: [12, 30, 22] }] },
        options: { legend: false, values: true },
      };
    case "code":
      return { id: freshId("code", taken), type: "code", language: "ts", ...place(900, 400), code: "const answer = 42;\n", lineNumbers: true, size: 28 };
    case "video":
      return { id: freshId("video", taken), type: "video", ...place(960, 540), url: "https://www.youtube-nocookie.com/embed/" };
  }
}

/** An image element fitted inside the slide, keeping the image's ratio. */
export function newImageElement(slide: Slide, deck: Doc["deck"], image: { path: string; width: number; height: number; credit?: ImageCredit }): SlideElement {
  const size = canvasSize(deck);
  const taken = allElementIds(slide.elements);
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 16 / 9;
  let w = Math.min(size.width * 0.6, 1100);
  let h = w / ratio;
  if (h > size.height * 0.8) {
    h = size.height * 0.8;
    w = h * ratio;
  }
  const z = Math.max(0, ...slide.elements.map((e) => e.z ?? 0)) + 1;
  const el: SlideElement = {
    id: freshId("image", taken),
    type: "image",
    src: image.path,
    fit: "cover",
    x: Math.round((size.width - w) / 2),
    y: Math.round((size.height - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
    z,
  };
  if (image.credit) el.credit = image.credit;
  return el;
}

export type ImageCredit = { source: "pixabay" | "openverse" | "upload" | "generated" | "other"; author?: string; url?: string };

export function insertElement(slideId: string, element: SlideElement): Recipe {
  return onSlide(slideId, (slide) => ({ ...slide, elements: [...slide.elements, element] }));
}

/** Turn a placeholder shape into an image with the same box and stacking. */
export function fillWithImage(slideId: string, shapeId: string, image: { path: string; credit?: ImageCredit }, alt?: string): Recipe {
  return patchElements(slideId, [shapeId], (el) => {
    const next: SlideElement = {
      id: el.id,
      type: "image",
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      src: image.path,
      fit: "cover",
    };
    if (el.z !== undefined) next.z = el.z;
    if (el.rotation) next.rotation = el.rotation;
    if (el.opacity !== undefined) next.opacity = el.opacity;
    if (el.animation) next.animation = el.animation;
    if (el.matchKey) next.matchKey = el.matchKey;
    if (el.type === "shape" && el.radius) next.radius = el.radius;
    if (image.credit) next.credit = image.credit;
    if (alt) next.alt = alt.slice(0, 300);
    return next;
  });
}
