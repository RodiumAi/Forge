/**
 * Animation timeline of a slide, PowerPoint style.
 *
 * Animated elements are ordered by `animation.order` (then document order).
 * Step 0 is the slide arriving: every "on-enter" element plays then. Each
 * "on-click" element opens a new step, consumed by one "next" press before the
 * deck moves to the following slide. An "after-previous" element plays in the
 * step of the element before it, once that one has finished.
 */

import type { Slide, SlideElement } from "./types";

export const DEFAULT_ANIMATION_MS = 500;

export type ScheduleEntry = {
  /** Step at which the element becomes visible (0 = on slide arrival). */
  step: number;
  /** Delay from the start of its step, in ms. */
  delayMs: number;
  durationMs: number;
};

export type Schedule = {
  entries: Map<string, ScheduleEntry>;
  /** Number of click steps; the slide is complete at `step === steps`. */
  steps: number;
};

/** Every element of a slide, groups flattened depth first. */
export function flattenElements(elements: SlideElement[]): SlideElement[] {
  const out: SlideElement[] = [];
  const walk = (list: SlideElement[]) => {
    for (const element of list) {
      out.push(element);
      if (element.type === "group") walk(element.children);
    }
  };
  walk(elements);
  return out;
}

export function buildSchedule(slide: Pick<Slide, "elements"> | null | undefined): Schedule {
  const entries = new Map<string, ScheduleEntry>();
  if (!slide) return { entries, steps: 0 };
  const animated = flattenElements(slide.elements)
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => !!element.animation && !element.hidden);
  animated.sort((a, b) => {
    const ao = a.element.animation?.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.element.animation?.order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo || a.index - b.index;
  });

  // "on-enter" always belongs to the arrival step, whatever its order.
  let enterEnd = 0;
  for (const { element } of animated) {
    const animation = element.animation!;
    if (animation.trigger !== "on-enter") continue;
    const delayMs = animation.delayMs ?? 0;
    const durationMs = animation.durationMs ?? DEFAULT_ANIMATION_MS;
    entries.set(element.id, { step: 0, delayMs, durationMs });
    enterEnd = Math.max(enterEnd, delayMs + durationMs);
  }

  let step = 0;
  let previousEnd = enterEnd;
  for (const { element } of animated) {
    const animation = element.animation!;
    if (animation.trigger === "on-enter") continue;
    const durationMs = animation.durationMs ?? DEFAULT_ANIMATION_MS;
    let delayMs: number;
    if (animation.trigger === "on-click") {
      step += 1;
      delayMs = animation.delayMs ?? 0;
    } else {
      delayMs = previousEnd + (animation.delayMs ?? 0);
    }
    entries.set(element.id, { step, delayMs, durationMs });
    previousEnd = delayMs + durationMs;
  }
  return { entries, steps: step };
}

/** Number of click steps of a slide. */
export function stepCount(slide: Pick<Slide, "elements"> | null | undefined): number {
  return buildSchedule(slide).steps;
}

/** Whether an element is shown at a given step (elements without animation always are). */
export function isVisibleAtStep(schedule: Schedule, elementId: string, step: number): boolean {
  const entry = schedule.entries.get(elementId);
  return !entry || entry.step <= step;
}

export type Position = { index: number; step: number };

/** Next position: the next click step, else the first step of the next slide. */
export function nextPosition(pos: Position, stepsOf: (index: number) => number, total: number): Position {
  if (pos.step < stepsOf(pos.index)) return { index: pos.index, step: pos.step + 1 };
  if (pos.index < total - 1) return { index: pos.index + 1, step: 0 };
  return pos;
}

/** Previous position: undo a click step, else the previous slide shown complete. */
export function previousPosition(pos: Position, stepsOf: (index: number) => number): Position {
  if (pos.step > 0) return { index: pos.index, step: pos.step - 1 };
  if (pos.index > 0) return { index: pos.index - 1, step: stepsOf(pos.index - 1) };
  return pos;
}
