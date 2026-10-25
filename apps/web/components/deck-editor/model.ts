/**
 * Pure operations on deck documents for the editor: element tree lookups,
 * grouping (children positioned relative to the group's top-left corner),
 * stacking order, duplication with fresh ids, clipboard and slide edits.
 *
 * Every function returns new objects and never mutates its input, so the
 * history keeps intact snapshots.
 */

import type { Deck, Slide, SlideElement } from "@/lib/contracts/forge-design";
import { aabb, rotatePoint, type Box } from "./geometry";

export type GroupElement = Extract<SlideElement, { type: "group" }>;
export type TextElement = Extract<SlideElement, { type: "text" }>;
export type ImageElement = Extract<SlideElement, { type: "image" }>;
export type ShapeElement = Extract<SlideElement, { type: "shape" }>;
export type ChartElement = Extract<SlideElement, { type: "chart" }>;
export type TableElement = Extract<SlideElement, { type: "table" }>;
export type SlideRef = Deck["slides"][number];

/** The editor's working copy: the deck and every slide body. */
export type Doc = { deck: Deck; slides: Record<string, Slide> };

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

/** A fresh id with this prefix, absent from `taken`. */
export function freshId(prefix: string, taken: Set<string>, random: () => number = Math.random): string {
  const base = prefix.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "e";
  for (let attempt = 0; attempt < 1000; attempt++) {
    const suffix = Math.floor(random() * 36 ** 4)
      .toString(36)
      .padStart(4, "0");
    const id = `${base}-${suffix}`;
    if (!taken.has(id) && isValidId(id)) {
      taken.add(id);
      return id;
    }
  }
  let n = taken.size + 1;
  while (taken.has(`${base}-${n}`)) n++;
  taken.add(`${base}-${n}`);
  return `${base}-${n}`;
}

// ── tree lookups ────────────────────────────────────────────────────────────

export type Located = {
  element: SlideElement;
  /** Ancestor groups, outermost first. */
  ancestors: GroupElement[];
  /** Siblings array the element lives in. */
  siblings: SlideElement[];
  index: number;
};

export function locate(elements: SlideElement[], id: string, ancestors: GroupElement[] = []): Located | null {
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    if (element.id === id) return { element, ancestors, siblings: elements, index };
    if (element.type === "group") {
      const found = locate(element.children, id, [...ancestors, element]);
      if (found) return found;
    }
  }
  return null;
}

export function findElement(slide: Slide | undefined, id: string): SlideElement | null {
  if (!slide) return null;
  return locate(slide.elements, id)?.element ?? null;
}

export function allElementIds(elements: SlideElement[], out: Set<string> = new Set()): Set<string> {
  for (const element of elements) {
    out.add(element.id);
    if (element.type === "group") allElementIds(element.children, out);
  }
  return out;
}

/** Offset of an element's coordinate space: the sum of its ancestors' corners. */
export function parentOffset(slide: Slide, id: string): { x: number; y: number } {
  const found = locate(slide.elements, id);
  if (!found) return { x: 0, y: 0 };
  return found.ancestors.reduce((acc, group) => ({ x: acc.x + group.x, y: acc.y + group.y }), { x: 0, y: 0 });
}

/** Box of an element in slide coordinates (ancestor rotation is not applied). */
export function absoluteBox(slide: Slide, id: string): Box | null {
  const found = locate(slide.elements, id);
  if (!found) return null;
  const offset = parentOffset(slide, id);
  const el = found.element;
  return { x: el.x + offset.x, y: el.y + offset.y, w: el.w, h: el.h, rotation: el.rotation ?? 0 };
}

/** Replace one element anywhere in the tree. */
export function updateElement(elements: SlideElement[], id: string, fn: (el: SlideElement) => SlideElement): SlideElement[] {
  let changed = false;
  const next = elements.map((element) => {
    if (element.id === id) {
      changed = true;
      return fn(element);
    }
    if (element.type === "group") {
      const children = updateElement(element.children, id, fn);
      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
    }
    return element;
  });
  return changed ? next : elements;
}

export function updateElements(elements: SlideElement[], ids: string[], fn: (el: SlideElement) => SlideElement): SlideElement[] {
  return ids.reduce((acc, id) => updateElement(acc, id, fn), elements);
}

/** Remove elements anywhere in the tree; a group left empty is removed too. */
export function removeElements(elements: SlideElement[], ids: Set<string>): SlideElement[] {
  const out: SlideElement[] = [];
  for (const element of elements) {
    if (ids.has(element.id)) continue;
    if (element.type === "group") {
      const children = removeElements(element.children, ids);
      if (children.length === 0) continue;
      out.push(children === element.children ? element : { ...element, children });
      continue;
    }
    out.push(element);
  }
  return out.length === elements.length && out.every((e, i) => e === elements[i]) ? elements : out;
}

/** Only the ids whose ancestors are not also selected (moving a group moves its children). */
export function outermost(slide: Slide, ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    const found = locate(slide.elements, id);
    return !!found && !found.ancestors.some((group) => set.has(group.id));
  });
}

// ── stacking order ──────────────────────────────────────────────────────────

/** Siblings in paint order (z, then array order), as the player sorts them. */
export function paintOrder(elements: SlideElement[]): SlideElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => (a.element.z ?? 0) - (b.element.z ?? 0) || a.index - b.index)
    .map(({ element }) => element);
}

export type ZMove = "forward" | "backward" | "front" | "back";

function reorderSiblings(siblings: SlideElement[], ids: Set<string>, move: ZMove): SlideElement[] {
  const order = paintOrder(siblings);
  if (!order.some((e) => ids.has(e.id))) return siblings;
  let next = [...order];
  if (move === "front") next = [...order.filter((e) => !ids.has(e.id)), ...order.filter((e) => ids.has(e.id))];
  else if (move === "back") next = [...order.filter((e) => ids.has(e.id)), ...order.filter((e) => !ids.has(e.id))];
  else if (move === "forward") {
    for (let i = next.length - 2; i >= 0; i--) {
      if (ids.has(next[i].id) && !ids.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (ids.has(next[i].id) && !ids.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]];
    }
  }
  // Array order follows paint order; z is rewritten so both agree.
  return next.map((element, index) => (element.z === index ? element : { ...element, z: index }));
}

/** Change the stacking order of elements among their siblings (any depth). */
export function moveZ(elements: SlideElement[], ids: string[], move: ZMove): SlideElement[] {
  const set = new Set(ids);
  const walk = (list: SlideElement[]): SlideElement[] => {
    let next = list.some((e) => set.has(e.id)) ? reorderSiblings(list, set, move) : list;
    let changed = next !== list;
    next = next.map((element) => {
      if (element.type !== "group") return element;
      const children = walk(element.children);
      if (children === element.children) return element;
      changed = true;
      return { ...element, children };
    });
    return changed ? next : list;
  };
  return walk(elements);
}

/**
 * Put sibling elements at a stacking position: `slot` counts the other
 * siblings that stay behind them (0 = at the back). Ids must share a parent.
 */
export function placeZ(elements: SlideElement[], ids: string[], slot: number): SlideElement[] {
  const set = new Set(ids);
  const walk = (list: SlideElement[]): SlideElement[] => {
    if (list.some((e) => set.has(e.id))) {
      const order = paintOrder(list);
      const moving = order.filter((e) => set.has(e.id));
      const rest = order.filter((e) => !set.has(e.id));
      const at = Math.max(0, Math.min(rest.length, slot));
      const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
      if (next.every((e, i) => e === list[i] && e.z === i)) return list;
      return next.map((element, index) => (element.z === index ? element : { ...element, z: index }));
    }
    let changed = false;
    const next = list.map((element) => {
      if (element.type !== "group") return element;
      const children = walk(element.children);
      if (children === element.children) return element;
      changed = true;
      return { ...element, children };
    });
    return changed ? next : list;
  };
  return walk(elements);
}

// ── groups ──────────────────────────────────────────────────────────────────

/**
 * Group sibling elements. The group box is the bounding box of the children
 * (their rotation included); children become relative to its corner.
 */
export function groupElements(slide: Slide, ids: string[], groupId: string): Slide {
  const located = ids.map((id) => locate(slide.elements, id)).filter((l): l is Located => !!l);
  if (located.length < 2) return slide;
  const siblings = located[0].siblings;
  if (!located.every((l) => l.siblings === siblings)) return slide;
  const members = new Set(located.map((l) => l.element.id));
  const boxes = located.map((l) => aabb(l.element));
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const ordered = paintOrder(siblings).filter((e) => members.has(e.id));
  const children = ordered.map((e, index) => ({ ...e, x: e.x - left, y: e.y - top, z: index }) as SlideElement);
  const z = Math.max(...located.map((l) => l.element.z ?? 0));
  const group: GroupElement = {
    id: groupId,
    type: "group",
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
    z,
    children,
  };
  const firstIndex = Math.min(...located.map((l) => l.index));
  const replace = (list: SlideElement[]): SlideElement[] => {
    if (list === siblings) {
      const out: SlideElement[] = [];
      list.forEach((element, index) => {
        if (index === firstIndex) out.push(group);
        if (!members.has(element.id)) out.push(element);
      });
      return out;
    }
    return list.map((element) => (element.type === "group" ? { ...element, children: replace(element.children) } : element));
  };
  return { ...slide, elements: replace(slide.elements) };
}

/**
 * Dissolve a group: children go back to the parent's space. A rotated group
 * rotates their centers around its own and adds its angle to theirs.
 */
export function ungroupElement(slide: Slide, groupId: string): Slide {
  const found = locate(slide.elements, groupId);
  if (!found || found.element.type !== "group") return slide;
  const group = found.element;
  const rotation = group.rotation ?? 0;
  const center = { x: group.x + group.w / 2, y: group.y + group.h / 2 };
  const groupOpacity = group.opacity ?? 1;
  const freed = group.children.map((child) => {
    const childCenter = { x: group.x + child.x + child.w / 2, y: group.y + child.y + child.h / 2 };
    const c = rotation ? rotatePoint(childCenter, center, rotation) : childCenter;
    const next: SlideElement = { ...child, x: round(c.x - child.w / 2), y: round(c.y - child.h / 2), z: group.z ?? child.z };
    if (rotation) next.rotation = normalizeAngle((child.rotation ?? 0) + rotation);
    if (groupOpacity !== 1) next.opacity = round2((child.opacity ?? 1) * groupOpacity);
    return next;
  });
  const replace = (list: SlideElement[]): SlideElement[] => {
    if (list === found.siblings) return list.flatMap((e) => (e.id === groupId ? freed : [e]));
    return list.map((element) => (element.type === "group" ? { ...element, children: replace(element.children) } : element));
  };
  return { ...slide, elements: replace(slide.elements) };
}

/**
 * Children of a group resized from `sx` x `sy`: positions and sizes follow,
 * and text, table and code sizes follow `textScale` (corner handles only).
 */
export function scaleChildren(children: SlideElement[], sx: number, sy: number, textScale = 1): SlideElement[] {
  const clampSize = (v: number, max: number) => Math.max(6, Math.min(max, Math.round(v * textScale * 10) / 10));
  return children.map((child) => {
    const next = {
      ...child,
      x: round(child.x * sx),
      y: round(child.y * sy),
      w: Math.max(1, round(child.w * sx)),
      h: Math.max(1, round(child.h * sy)),
    } as SlideElement;
    if (textScale !== 1) {
      if (next.type === "text" && next.style?.size) next.style = { ...next.style, size: clampSize(next.style.size, 400) };
      if (next.type === "table" && next.style?.size) next.style = { ...next.style, size: clampSize(next.style.size, 200) };
      if (next.type === "code" && next.size) next.size = clampSize(next.size, 200);
    }
    if (next.type === "group") next.children = scaleChildren(next.children, sx, sy, textScale);
    return next;
  });
}

// ── duplication and clipboard ───────────────────────────────────────────────

export function cloneWithFreshIds(element: SlideElement, taken: Set<string>): SlideElement {
  const prefix = element.id.replace(/-[a-z0-9]{4}$/, "");
  const id = freshId(prefix, taken);
  if (element.type === "group") {
    return { ...element, id, children: element.children.map((child) => cloneWithFreshIds(child, taken)) };
  }
  const copy = { ...element, id } as SlideElement;
  // A copy must not morph into its original on the next slide.
  if (copy.matchKey) delete copy.matchKey;
  return copy;
}

/** Copies of the elements placed next to the originals (same parent, +offset). */
export function duplicateElements(slide: Slide, ids: string[], offset = 24): { slide: Slide; ids: string[] } {
  const taken = allElementIds(slide.elements);
  const top = outermost(slide, ids);
  let elements = slide.elements;
  const created: string[] = [];
  for (const id of top) {
    const found = locate(elements, id);
    if (!found) continue;
    const copy = cloneWithFreshIds(found.element, taken);
    copy.x = found.element.x + offset;
    copy.y = found.element.y + offset;
    copy.z = (found.element.z ?? 0) + 1;
    created.push(copy.id);
    const insert = (list: SlideElement[]): SlideElement[] => {
      if (list === found.siblings) return [...list.slice(0, found.index + 1), copy, ...list.slice(found.index + 1)];
      return list.map((e) => (e.type === "group" ? { ...e, children: insert(e.children) } : e));
    };
    elements = insert(elements);
  }
  return { slide: { ...slide, elements }, ids: created };
}

export type ClipboardPayload = { kind: "forge-deck-elements"; slideId: string; elements: SlideElement[] };

/** Selected elements as absolute top-level copies, for the clipboard. */
export function copyElements(slide: Slide, ids: string[]): ClipboardPayload {
  const elements = outermost(slide, ids)
    .map((id) => {
      const found = locate(slide.elements, id);
      if (!found) return null;
      const offset = parentOffset(slide, id);
      return { ...found.element, x: found.element.x + offset.x, y: found.element.y + offset.y } as SlideElement;
    })
    .filter((e): e is SlideElement => !!e);
  return { kind: "forge-deck-elements", slideId: slide.id, elements };
}

export function parseClipboard(text: string): ClipboardPayload | null {
  try {
    const data = JSON.parse(text) as ClipboardPayload;
    if (data && data.kind === "forge-deck-elements" && Array.isArray(data.elements)) return data;
  } catch {
    /* not ours */
  }
  return null;
}

/** Paste copies at the top of the slide; offset when pasting where they came from. */
export function pasteElements(slide: Slide, payload: ClipboardPayload, offset = 24): { slide: Slide; ids: string[] } {
  const taken = allElementIds(slide.elements);
  const shift = payload.slideId === slide.id ? offset : 0;
  const top = Math.max(0, ...slide.elements.map((e) => e.z ?? 0));
  const copies = payload.elements.map((element, index) => {
    const copy = cloneWithFreshIds(element, taken);
    copy.x = element.x + shift;
    copy.y = element.y + shift;
    copy.z = top + 1 + index;
    return copy;
  });
  return { slide: { ...slide, elements: [...slide.elements, ...copies] }, ids: copies.map((c) => c.id) };
}

// ── slides in the deck ──────────────────────────────────────────────────────

export function slideIds(deck: Deck): string[] {
  return deck.slides.map((ref) => ref.id);
}

/** Move one slide reference to another position. */
export function moveSlide(deck: Deck, from: number, to: number): Deck {
  if (from === to || from < 0 || from >= deck.slides.length) return deck;
  const slides = [...deck.slides];
  const [ref] = slides.splice(from, 1);
  slides.splice(Math.max(0, Math.min(to, slides.length)), 0, ref);
  return { ...deck, slides };
}

export function insertSlide(doc: Doc, ref: SlideRef, slide: Slide, index: number): Doc {
  const slides = [...doc.deck.slides];
  slides.splice(Math.max(0, Math.min(index, slides.length)), 0, ref);
  return { deck: { ...doc.deck, slides }, slides: { ...doc.slides, [slide.id]: slide } };
}

export function removeSlide(doc: Doc, id: string): Doc {
  const slides = { ...doc.slides };
  delete slides[id];
  return { deck: { ...doc.deck, slides: doc.deck.slides.filter((ref) => ref.id !== id) }, slides };
}

export function duplicateSlide(doc: Doc, id: string): { doc: Doc; id: string } {
  const index = doc.deck.slides.findIndex((ref) => ref.id === id);
  const source = doc.slides[id];
  if (index < 0 || !source) return { doc, id };
  const newId = freshId("s", new Set(slideIds(doc.deck)));
  const ref: SlideRef = { ...doc.deck.slides[index], id: newId };
  const copy: Slide = structuredCloneSafe({ ...source, id: newId });
  return { doc: insertSlide(doc, ref, copy, index + 1), id: newId };
}

export function updateSlide(doc: Doc, id: string, fn: (slide: Slide) => Slide): Doc {
  const slide = doc.slides[id];
  if (!slide) return doc;
  const next = fn(slide);
  return next === slide ? doc : { ...doc, slides: { ...doc.slides, [id]: next } };
}

export function updateRef(doc: Doc, id: string, fn: (ref: SlideRef) => SlideRef): Doc {
  return { ...doc, deck: { ...doc.deck, slides: doc.deck.slides.map((ref) => (ref.id === id ? fn(ref) : ref)) } };
}

// ── small helpers ───────────────────────────────────────────────────────────

export function round(value: number): number {
  return Math.round(value) || 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 10) / 10;
}

export function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Order-insensitive deep equality for JSON documents. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => sameJson(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => sameJson(ao[k], bo[k]));
}

/** Short human label of an element, for layer lists and AI targets. */
export function elementLabel(element: SlideElement): string {
  if (element.name) return element.name;
  if (element.type === "text") {
    const first = element.content[0];
    const raw =
      first?.type === "paragraph"
        ? (first.text ?? first.runs?.map((r) => r.text).join("") ?? "")
        : first
          ? (first.items[0]?.text ?? first.items[0]?.runs?.map((r) => r.text).join("") ?? "")
          : "";
    const text = raw.trim().replace(/\s+/g, " ");
    if (text) return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
  return element.id;
}
