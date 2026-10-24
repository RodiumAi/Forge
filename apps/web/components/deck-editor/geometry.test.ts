import { describe, expect, it } from "vitest";
import {
  aabb,
  alignDeltas,
  containsPoint,
  corners,
  distributeDeltas,
  HANDLES,
  hitTest,
  resizeBox,
  rotatePoint,
  rotationFromPointer,
  snapMove,
  snapTargets,
} from "./geometry";

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe("rotation helpers", () => {
  it("rotates a point clockwise around a center (screen y down)", () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    close(p.x, 0);
    close(p.y, 10);
  });

  it("gives the bounding box of a rotated box", () => {
    const box = aabb({ x: 0, y: 0, w: 100, h: 100, rotation: 45 });
    close(box.w, Math.SQRT2 * 100);
    close(box.x, 50 - (Math.SQRT2 * 100) / 2);
  });

  it("tests points inside a rotated box", () => {
    const box = { x: 0, y: 40, w: 100, h: 20, rotation: 90 };
    expect(containsPoint(box, { x: 50, y: 5 })).toBe(true);
    expect(containsPoint(box, { x: 5, y: 50 })).toBe(false);
    expect(corners(box)).toHaveLength(4);
  });

  it("hit tests the top-most element in paint order", () => {
    const items = [
      { id: "a", x: 0, y: 0, w: 100, h: 100, z: 2 },
      { id: "b", x: 50, y: 50, w: 100, h: 100, z: 1 },
      { id: "c", x: 50, y: 50, w: 100, h: 100, z: 1 },
    ];
    expect(hitTest(items, { x: 75, y: 75 })?.id).toBe("a");
    expect(hitTest(items, { x: 120, y: 120 })?.id).toBe("c");
    expect(hitTest(items, { x: 500, y: 500 })).toBeNull();
  });
});

describe("move with snapping", () => {
  const canvas = { width: 1920, height: 1080 };

  it("snaps the center to the slide center within the threshold", () => {
    const rect = { x: 0, y: 0, w: 200, h: 100 };
    const result = snapMove(rect, 857, 3, snapTargets(canvas, []), 6, canvas);
    expect(result.dx).toBe(860);
    expect(result.dy).toBe(0);
    expect(result.guides.map((g) => g.axis).sort()).toEqual(["x", "y"]);
  });

  it("snaps an edge to another element's edge", () => {
    const rect = { x: 0, y: 500, w: 100, h: 100 };
    const others = [{ x: 400, y: 200, w: 300, h: 50 }];
    const result = snapMove(rect, 297, 0, snapTargets(canvas, others), 5, canvas);
    expect(result.dx).toBe(300);
    expect(result.guides).toEqual([{ axis: "x", at: 400, from: 0, to: 1080 }]);
  });

  it("does not snap beyond the threshold", () => {
    const rect = { x: 100, y: 100, w: 50, h: 50 };
    const result = snapMove(rect, 333, 211, { x: [], y: [] }, 5, canvas);
    expect(result).toEqual({ dx: 333, dy: 211, guides: [] });
  });
});

describe("resize", () => {
  it("drags the bottom-right corner of an unrotated box", () => {
    const box = resizeBox({ x: 10, y: 20, w: 100, h: 50 }, HANDLES.se, { x: 30, y: 10 });
    expect(box).toMatchObject({ x: 10, y: 20, w: 130, h: 60 });
  });

  it("keeps the opposite corner fixed when dragging the top-left corner", () => {
    const box = resizeBox({ x: 10, y: 20, w: 100, h: 50 }, HANDLES.nw, { x: 30, y: 10 });
    expect(box).toMatchObject({ x: 40, y: 30, w: 70, h: 40 });
  });

  it("keeps the ratio from a corner", () => {
    const box = resizeBox({ x: 0, y: 0, w: 200, h: 100 }, HANDLES.se, { x: 100, y: 0 }, { keepRatio: true });
    expect(box.w).toBe(300);
    expect(box.h).toBe(150);
  });

  it("respects the minimum size", () => {
    const box = resizeBox({ x: 0, y: 0, w: 100, h: 100 }, HANDLES.e, { x: -500, y: 0 });
    expect(box.w).toBe(8);
    expect(box.x).toBe(0);
  });

  it("resizes a rotated box in its own frame and keeps the anchor in place", () => {
    const start = { x: 0, y: 0, w: 100, h: 50, rotation: 90 };
    // Rotated 90 degrees: the box's local x axis points down on screen.
    const anchorBefore = corners(start)[0];
    const box = resizeBox(start, HANDLES.e, { x: 0, y: 40 });
    close(box.w, 140);
    close(box.h, 50);
    const anchorAfter = corners(box)[0];
    close(anchorAfter.x, anchorBefore.x);
    close(anchorAfter.y, anchorBefore.y);
  });
});

describe("rotation from the pointer", () => {
  it("measures the angle from straight up and snaps right angles", () => {
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(0);
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: 10, y: 0.3 })).toBe(90);
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(-90);
  });

  it("snaps to 15 degrees with shift", () => {
    const angle = rotationFromPointer({ x: 0, y: 0 }, { x: 10, y: -12 }, true);
    expect(angle % 15).toBe(0);
  });
});

describe("align and distribute", () => {
  const rects = [
    { id: "a", rect: { x: 10, y: 10, w: 100, h: 50 } },
    { id: "b", rect: { x: 300, y: 100, w: 50, h: 50 } },
  ];

  it("aligns left edges and centers", () => {
    expect(alignDeltas(rects, { x: 10, y: 10, w: 340, h: 140 }, "left")).toEqual({ a: { x: 0, y: 0 }, b: { x: -290, y: 0 } });
    expect(alignDeltas(rects, { x: 0, y: 0, w: 1920, h: 1080 }, "vmiddle").a).toEqual({ x: 0, y: 505 });
  });

  it("distributes with equal gaps", () => {
    const deltas = distributeDeltas(
      [
        { id: "a", rect: { x: 0, y: 0, w: 100, h: 10 } },
        { id: "b", rect: { x: 150, y: 0, w: 100, h: 10 } },
        { id: "c", rect: { x: 500, y: 0, w: 100, h: 10 } },
      ],
      "x",
    );
    expect(deltas.b).toEqual({ x: 100, y: 0 });
    expect(deltas.a).toEqual({ x: 0, y: 0 });
    expect(deltas.c).toEqual({ x: 0, y: 0 });
  });
});
