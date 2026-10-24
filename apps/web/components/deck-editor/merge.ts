/**
 * Three-way merges used when a save hits 409 (the file changed on the server
 * since we loaded it): `base` is what we last read or wrote, `mine` the local
 * copy, `theirs` the server's current one.
 *
 * Slides merge element by element (top-level ids) and the background apart;
 * the deck merges its fields and slide references by id. When both sides
 * changed the same element, field or reference differently, the merge fails
 * and the editor asks the user which version to keep.
 */

import type { Deck, Slide, SlideElement } from "@/lib/contracts/forge-design";
import { sameJson } from "./model";

export type MergeResult<T> = { ok: true; value: T } | { ok: false; conflicts: string[] };

function pick<T>(key: string, base: T, mine: T, theirs: T, conflicts: string[]): T {
  if (sameJson(mine, theirs)) return mine;
  if (sameJson(mine, base)) return theirs;
  if (sameJson(theirs, base)) return mine;
  conflicts.push(key);
  return mine;
}

/** Merge lists of id-carrying items; order follows `mine` unless only `theirs` reordered. */
function mergeById<T extends { id: string }>(prefix: string, base: T[], mine: T[], theirs: T[], conflicts: string[]): T[] {
  const baseMap = new Map(base.map((item) => [item.id, item]));
  const mineMap = new Map(mine.map((item) => [item.id, item]));
  const theirsMap = new Map(theirs.map((item) => [item.id, item]));
  const ids = new Set([...baseMap.keys(), ...mineMap.keys(), ...theirsMap.keys()]);
  const kept = new Map<string, T>();
  for (const id of ids) {
    const b = baseMap.get(id);
    const m = mineMap.get(id);
    const t = theirsMap.get(id);
    if (m && t) {
      kept.set(id, pick(`${prefix}${id}`, b, m, t, conflicts) as T);
    } else if (m && !t) {
      // Deleted on the server: keep only if it is new here or we changed it.
      if (!b) kept.set(id, m);
      else if (!sameJson(m, b)) {
        conflicts.push(`${prefix}${id}`);
        kept.set(id, m);
      }
    } else if (!m && t) {
      // Deleted here: drop unless the server changed it meanwhile.
      if (!b) kept.set(id, t);
      else if (!sameJson(t, b)) conflicts.push(`${prefix}${id}`);
    }
  }
  const order = (list: T[]) => list.map((item) => item.id);
  const mineReordered = !sameJson(order(mine).filter((id) => baseMap.has(id)), order(base).filter((id) => mineMap.has(id)));
  const primary = mineReordered ? mine : theirs;
  const secondary = mineReordered ? theirs : mine;
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of primary) {
    const value = kept.get(item.id);
    if (value && !seen.has(item.id)) {
      out.push(value);
      seen.add(item.id);
    }
  }
  // Items only on the other side go after their predecessor, or at the end.
  secondary.forEach((item, index) => {
    if (seen.has(item.id) || !kept.has(item.id)) return;
    const before = secondary.slice(0, index).reverse().find((prev) => seen.has(prev.id));
    const at = before ? out.findIndex((x) => x.id === before.id) + 1 : 0;
    out.splice(at, 0, kept.get(item.id)!);
    seen.add(item.id);
  });
  return out;
}

export function mergeSlide(base: Slide, mine: Slide, theirs: Slide): MergeResult<Slide> {
  const conflicts: string[] = [];
  const background = pick("background", base.background, mine.background, theirs.background, conflicts);
  const elements = mergeById<SlideElement>("element:", base.elements, mine.elements, theirs.elements, conflicts);
  if (conflicts.length) return { ok: false, conflicts };
  const value: Slide = { id: mine.id, elements };
  if (background) value.background = background;
  return { ok: true, value };
}

export function mergeDeck(base: Deck, mine: Deck, theirs: Deck): MergeResult<Deck> {
  const conflicts: string[] = [];
  const title = pick("title", base.title, mine.title, theirs.title, conflicts);
  const format = pick("format", base.format, mine.format, theirs.format, conflicts);
  const theme = pick("theme", base.theme, mine.theme, theirs.theme, conflicts);
  const slides = mergeById("slide:", base.slides, mine.slides, theirs.slides, conflicts);
  if (conflicts.length) return { ok: false, conflicts };
  const value: Deck = { version: 1, format, theme, slides };
  if (title !== undefined) value.title = title;
  return { ok: true, value };
}
