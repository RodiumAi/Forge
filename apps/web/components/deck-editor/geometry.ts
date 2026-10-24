/**
 * Canvas math of the deck editor, in canvas pixels (1920 x 1080 and friends):
 * rotated boxes, hit testing, move with snapping guides, resize from any
 * handle of a rotated box, rotation, alignment and distribution.
 *
 * Pure functions, no DOM: the interaction layer converts pointer positions to
 * canvas coordinates and feeds them here.
 */

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number; rotation?: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const MIN_SIZE = 8;

const RAD = Math.PI / 180;

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  if (!deg) return { ...p };
  const a = deg * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function center(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** The four corners of a box after rotation, clockwise from top-left. */
export function corners(box: Box): Point[] {
  const c = center(box);
  const r = box.rotation ?? 0;
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ].map((p) => rotatePoint(p, c, r));
}

/** Axis-aligned bounding box of a (possibly rotated) box. */
export function aabb(box: Box): Rect {
  if (!box.rotation) return { x: box.x, y: box.y, w: box.w, h: box.h };
  const pts = corners(box);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** True when the point lies inside the rotated box. */
export function containsPoint(box: Box, p: Point): boolean {
  const local = rotatePoint(p, center(box), -(box.rotation ?? 0));
  return local.x >= box.x && local.x <= box.x + box.w && local.y >= box.y && local.y <= box.y + box.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Normalized rectangle between two points (marquee selection). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

type Hittable = Box & { id: string; z?: number; locked?: boolean };

/**
 * Top-most box under the point, in paint order (z then array order): the last
 * painted wins, like the browser.
 */
export function hitTest<T extends Hittable>(items: T[], p: Point): T | null {
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.z ?? 0) - (a.item.z ?? 0) || b.index - a.index);
  for (const { item } of ordered) {
    if (containsPoint(item, p)) return item;
  }
  return null;
}

// ── snapping ────────────────────────────────────────────────────────────────

export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };
export type SnapTargets = { x: number[]; y: number[] };

/** Lines other boxes can snap to: the slide edges and center, other boxes' edges and centers. */
export function snapTargets(canvas: { width: number; height: number }, others: Rect[]): SnapTargets {
  const x = [0, canvas.width / 2, canvas.width];
  const y = [0, canvas.height / 2, canvas.height];
  for (const r of others) {
    x.push(r.x, r.x + r.w / 2, r.x + r.w);
    y.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { x, y };
}

function bestSnap(values: number[], targets: number[], threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const delta = t - v;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t };
    }
  }
  return best;
}

/**
 * Move a rectangle by (dx, dy) and snap its edges or center to the nearest
 * target within `threshold`. Returns the corrected delta and the guides to draw.
 */
export function snapMove(
  rect: Rect,
  dx: number,
  dy: number,
  targets: SnapTargets,
  threshold: number,
  extent: { width: number; height: number },
): { dx: number; dy: number; guides: Guide[] } {
  const moved = { ...rect, x: rect.x + dx, y: rect.y + dy };
  const sx = bestSnap([moved.x, moved.x + moved.w / 2, moved.x + moved.w], targets.x, threshold);
  const sy = bestSnap([moved.y, moved.y + moved.h / 2, moved.y + moved.h], targets.y, threshold);
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: "x", at: sx.at, from: 0, to: extent.height });
  if (sy) guides.push({ axis: "y", at: sy.at, from: 0, to: extent.width });
  return { dx: dx + (sx?.delta ?? 0), dy: dy + (sy?.delta ?? 0), guides };
}

// ── resize ──────────────────────────────────────────────────────────────────

/** Resize handle: horizontal and vertical side, -1 (left/top), 0 (middle) or 1 (right/bottom). */
export type Handle = { sx: -1 | 0 | 1; sy: -1 | 0 | 1 };

export const HANDLES: Record<string, Handle> = {
  nw: { sx: -1, sy: -1 },
  n: { sx: 0, sy: -1 },
  ne: { sx: 1, sy: -1 },
  e: { sx: 1, sy: 0 },
  se: { sx: 1, sy: 1 },
  s: { sx: 0, sy: 1 },
  sw: { sx: -1, sy: 1 },
  w: { sx: -1, sy: 0 },
};

/**
 * Resize a (rotated) box by dragging one handle by a world-space delta. The
 * opposite handle stays fixed on screen. `keepRatio` scales uniformly from a
 * corner (Shift, and images by default).
 */
export function resizeBox(box: Box, handle: Handle, delta: Point, opts: { keepRatio?: boolean; minSize?: number } = {}): Box {
  const min = opts.minSize ?? MIN_SIZE;
  const rotation = box.rotation ?? 0;
  const local = rotatePoint(delta, { x: 0, y: 0 }, -rotation);
  let w = box.w + handle.sx * local.x;
  let h = box.h + handle.sy * local.y;
  if (opts.keepRatio && handle.sx !== 0 && handle.sy !== 0) {
    const scale = Math.max(w / box.w, h / box.h);
    w = box.w * scale;
    h = box.h * scale;
  } else if (opts.keepRatio && (handle.sx === 0 || handle.sy === 0)) {
    // Side handle with a locked ratio: the other side follows.
    if (handle.sx !== 0) h = (w / box.w) * box.h;
    else w = (h / box.h) * box.w;
  }
  w = Math.max(min, w);
  h = Math.max(min, h);
  if (opts.keepRatio) {
    // Keep the ratio even when the minimum kicked in on one side.
    const ratio = box.w / box.h;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }
  const c = center(box);
  // The anchor (opposite handle) in local coordinates, before and after.
  const anchorOld = { x: (-handle.sx * box.w) / 2, y: (-handle.sy * box.h) / 2 };
  const anchorWorld = rotatePoint({ x: c.x + anchorOld.x, y: c.y + anchorOld.y }, c, rotation);
  const anchorNew = { x: (-handle.sx * w) / 2, y: (-handle.sy * h) / 2 };
  const offset = rotatePoint(anchorNew, { x: 0, y: 0 }, rotation);
  // Side handles with a locked ratio grow symmetrically on the other axis.
  const nc = { x: anchorWorld.x - offset.x, y: anchorWorld.y - offset.y };
  return { x: nc.x - w / 2, y: nc.y - h / 2, w, h, rotation };
}

/** Round a box to whole pixels (documents store integers for readability). */
export function roundBox<T extends Box>(box: T): T {
  return { ...box, x: Math.round(box.x) || 0, y: Math.round(box.y) || 0, w: Math.max(1, Math.round(box.w)), h: Math.max(1, Math.round(box.h)) };
}

// ── rotation ────────────────────────────────────────────────────────────────

/**
 * Angle (degrees, -180..180) of a rotation handle dragged to `pointer`; 0
 * means the handle straight above the center. Shift snaps to 15 degree steps,
 * and right angles attract within 3 degrees.
 */
export function rotationFromPointer(c: Point, pointer: Point, snap15 = false): number {
  let deg = Math.atan2(pointer.x - c.x, -(pointer.y - c.y)) / RAD;
  if (snap15) deg = Math.round(deg / 15) * 15;
  else {
    const right = Math.round(deg / 90) * 90;
    if (Math.abs(deg - right) <= 3) deg = right;
  }
  if (deg > 180) deg -= 360;
  if (deg <= -180) deg += 360;
  return Math.round(deg * 10) / 10 || 0;
}

// ── alignment ───────────────────────────────────────────────────────────────

export type Align = "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom";

/**
 * Deltas aligning each rectangle to `reference` (the selection bounds, or the
 * slide when a single element is aligned).
 */
export function alignDeltas(rects: { id: string; rect: Rect }[], reference: Rect, align: Align): Record<string, Point> {
  const out: Record<string, Point> = {};
  for (const { id, rect } of rects) {
    let dx = 0;
    let dy = 0;
    if (align === "left") dx = reference.x - rect.x;
    if (align === "hcenter") dx = reference.x + reference.w / 2 - (rect.x + rect.w / 2);
    if (align === "right") dx = reference.x + reference.w - (rect.x + rect.w);
    if (align === "top") dy = reference.y - rect.y;
    if (align === "vmiddle") dy = reference.y + reference.h / 2 - (rect.y + rect.h / 2);
    if (align === "bottom") dy = reference.y + reference.h - (rect.y + rect.h);
    out[id] = { x: Math.round(dx), y: Math.round(dy) };
  }
  return out;
}

/** Equal gaps between three or more rectangles along an axis. */
export function distributeDeltas(rects: { id: string; rect: Rect }[], axis: "x" | "y"): Record<string, Point> {
  const out: Record<string, Point> = {};
  if (rects.length < 3) return out;
  const pos = (r: Rect) => (axis === "x" ? r.x : r.y);
  const len = (r: Rect) => (axis === "x" ? r.w : r.h);
  const sorted = [...rects].sort((a, b) => pos(a.rect) - pos(b.rect));
  const first = sorted[0].rect;
  const last = sorted[sorted.length - 1].rect;
  const total = pos(last) + len(last) - pos(first);
  const used = sorted.reduce((sum, item) => sum + len(item.rect), 0);
  const gap = (total - used) / (sorted.length - 1);
  let cursor = pos(first);
  for (const item of sorted) {
    const delta = Math.round(cursor - pos(item.rect));
    out[item.id] = axis === "x" ? { x: delta, y: 0 } : { x: 0, y: delta };
    cursor += len(item.rect) + gap;
  }
  return out;
}
