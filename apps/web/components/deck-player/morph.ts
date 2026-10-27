/**
 * "Morph" transition: elements sharing a `matchKey` on two consecutive slides
 * move and resize from their old box to their new one.
 */

import { flattenElements } from "./steps";
import type { Slide, SlideElement } from "./types";

export type Box = { x: number; y: number; w: number; h: number; rotation: number; opacity: number };

export function boxOf(element: SlideElement): Box {
  return {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
  };
}

/**
 * For each element of `next` with a matchKey also present in `prev`, the box
 * it starts from (keyed by the id of the element in `next`). Top level
 * elements only: a group moves with its children. Hidden elements and
 * duplicate keys (first one wins) are ignored.
 */
export function matchMorph(prev: Pick<Slide, "elements"> | null | undefined, next: Pick<Slide, "elements"> | null | undefined): Map<string, Box> {
  const out = new Map<string, Box>();
  if (!prev || !next) return out;
  const fromByKey = new Map<string, SlideElement>();
  for (const element of prev.elements) {
    if (element.matchKey && !element.hidden && !fromByKey.has(element.matchKey)) fromByKey.set(element.matchKey, element);
  }
  const used = new Set<string>();
  for (const element of next.elements) {
    const key = element.matchKey;
    if (!key || element.hidden || used.has(key)) continue;
    const from = fromByKey.get(key);
    if (!from) continue;
    used.add(key);
    out.set(element.id, boxOf(from));
  }
  return out;
}

/** Ids of the elements of `prev` that morph into `next` (hidden while leaving). */
export function morphedSourceIds(prev: Pick<Slide, "elements"> | null | undefined, next: Pick<Slide, "elements"> | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!prev || !next) return ids;
  const keys = new Set(next.elements.filter((e) => e.matchKey && !e.hidden).map((e) => e.matchKey as string));
  const taken = new Set<string>();
  for (const element of prev.elements) {
    const key = element.matchKey;
    if (!key || element.hidden || taken.has(key) || !keys.has(key)) continue;
    taken.add(key);
    ids.add(element.id);
  }
  return ids;
}

/** Every element id of a slide, for tests and editors. */
export function elementIds(slide: Pick<Slide, "elements">): string[] {
  return flattenElements(slide.elements).map((e) => e.id);
}
