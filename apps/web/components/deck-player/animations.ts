/**
 * Motion presets of the player: element entrance animations and slide
 * transitions, as framer-motion targets. Pure data, unit tested.
 */

import type { Animation, Transition } from "./types";

type Target = Record<string, string | number | number[] | string[]>;

export type ElementMotion = {
  hidden: Target;
  visible: Target;
  ease?: number[] | string | ((t: number) => number);
  spring?: { bounce: number };
};

const OFFSET = 80;

function offsetFor(direction: Animation["direction"], fallback: "left" | "right" | "up" | "down"): { x: number; y: number } {
  switch (direction ?? fallback) {
    case "left":
      return { x: -OFFSET * 1.5, y: 0 };
    case "right":
      return { x: OFFSET * 1.5, y: 0 };
    case "up":
      return { x: 0, y: -OFFSET };
    default:
      return { x: 0, y: OFFSET };
  }
}

const SHOWN_CLIP = "inset(0% 0% 0% 0%)";

function revealClip(direction: Animation["direction"]): string {
  switch (direction ?? "left") {
    case "right":
      return "inset(0% 0% 0% 100%)";
    case "up":
      return "inset(0% 0% 100% 0%)";
    case "down":
      return "inset(100% 0% 0% 0%)";
    default:
      return "inset(0% 100% 0% 0%)";
  }
}

/** Twenty discrete steps, the typewriter cadence. */
export const steppedEase = (t: number) => Math.min(1, Math.floor(t * 20) / 20);

/** Hidden and visible states of an element animation. */
export function elementMotion(animation: Pick<Animation, "type" | "direction">): ElementMotion {
  switch (animation.type) {
    case "rise":
      return { hidden: { opacity: 0, y: OFFSET }, visible: { opacity: 1, y: 0 }, ease: "easeOut" };
    case "drop":
      return { hidden: { opacity: 0, y: -OFFSET }, visible: { opacity: 1, y: 0 }, ease: "easeOut" };
    case "slide": {
      const { x, y } = offsetFor(animation.direction, "left");
      return { hidden: { opacity: 0, x, y }, visible: { opacity: 1, x: 0, y: 0 }, ease: "easeOut" };
    }
    case "pop":
      return { hidden: { opacity: 0, scale: 0.4 }, visible: { opacity: 1, scale: 1 }, ease: "backOut" };
    case "zoom":
      return { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 }, ease: "easeOut" };
    case "typewriter":
      return { hidden: { clipPath: "inset(0% 100% 0% 0%)" }, visible: { clipPath: SHOWN_CLIP }, ease: steppedEase };
    case "mask-reveal":
      return { hidden: { clipPath: revealClip(animation.direction) }, visible: { clipPath: SHOWN_CLIP }, ease: "easeInOut" };
    case "bounce":
      return { hidden: { opacity: 0, y: -OFFSET * 2 }, visible: { opacity: 1, y: 0 }, spring: { bounce: 0.55 } };
    case "pulse":
      return { hidden: { opacity: 0, scale: 1 }, visible: { opacity: 1, scale: [0.92, 1.08, 1] }, ease: "easeInOut" };
    case "appear":
    default:
      return { hidden: { opacity: 0 }, visible: { opacity: 1 }, ease: "easeOut" };
  }
}

export type Bezier = [number, number, number, number];

const EASINGS: Record<string, Bezier | "linear"> = {
  linear: "linear",
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

export function easingOf(easing: Transition["easing"]): Bezier | "linear" {
  return EASINGS[easing ?? "ease-in-out"] ?? EASINGS["ease-in-out"];
}

export const DEFAULT_TRANSITION_MS: Record<Transition["type"], number> = {
  none: 0,
  fade: 500,
  push: 600,
  slide: 600,
  wipe: 600,
  "zoom-in": 600,
  "zoom-out": 600,
  dissolve: 700,
  curtain: 800,
  cube: 800,
  morph: 800,
};

export function transitionDuration(transition: Transition | undefined): number {
  const type = transition?.type ?? "none";
  return transition?.durationMs ?? DEFAULT_TRANSITION_MS[type] ?? 0;
}

/** Context handed to AnimatePresence: which transition, and which way the deck moves. */
export type SlideMotionContext = { transition: Transition; dir: 1 | -1 };

type Pct = string;
function vector(direction: Transition["direction"], dir: 1 | -1): { x: Pct; y: Pct; ox: Pct; oy: Pct } {
  // direction "left": content moves left, the new slide arrives from the right.
  let x = 0;
  let y = 0;
  switch (direction ?? "left") {
    case "left":
      x = 1;
      break;
    case "right":
      x = -1;
      break;
    case "up":
      y = 1;
      break;
    case "down":
      y = -1;
      break;
  }
  x *= dir;
  y *= dir;
  return { x: `${x * 100}%`, y: `${y * 100}%`, ox: `${-x * 100}%`, oy: `${-y * 100}%` };
}

function wipeClip(direction: Transition["direction"], dir: 1 | -1): string {
  const flip: Record<string, string> = { left: "right", right: "left", up: "down", down: "up" };
  const d = dir === 1 ? (direction ?? "left") : flip[direction ?? "left"];
  switch (d) {
    case "right":
      return "inset(0% 100% 0% 0%)";
    case "up":
      return "inset(100% 0% 0% 0%)";
    case "down":
      return "inset(0% 0% 100% 0%)";
    default:
      return "inset(0% 0% 0% 100%)";
  }
}

export type SlideStates = { enter: Target; center: Target; exit: Target; exitDurationScale?: number };

/** Enter, resting and exit states of a slide for a transition. */
export function slideStates(ctx: SlideMotionContext): SlideStates {
  const { transition, dir } = ctx;
  const stay = { opacity: 1, zIndex: 1 };
  switch (transition.type) {
    case "fade":
      return { enter: { opacity: 0, zIndex: 2 }, center: { opacity: 1, zIndex: 2 }, exit: { opacity: 0, zIndex: 1 } };
    case "dissolve":
      return {
        enter: { opacity: 0, filter: "blur(12px)", zIndex: 2 },
        center: { opacity: 1, filter: "blur(0px)", zIndex: 2 },
        exit: { opacity: 0, filter: "blur(12px)", zIndex: 1 },
      };
    case "push": {
      const v = vector(transition.direction, dir);
      return {
        enter: { x: v.x, y: v.y, zIndex: 2 },
        center: { x: "0%", y: "0%", zIndex: 2 },
        exit: { x: v.ox, y: v.oy, zIndex: 1 },
      };
    }
    case "slide": {
      const v = vector(transition.direction, dir);
      return { enter: { x: v.x, y: v.y, zIndex: 2 }, center: { x: "0%", y: "0%", zIndex: 2 }, exit: stay };
    }
    case "wipe":
      return {
        enter: { clipPath: wipeClip(transition.direction, dir), zIndex: 2 },
        center: { clipPath: SHOWN_CLIP, zIndex: 2 },
        exit: stay,
      };
    case "curtain":
      return {
        enter: { clipPath: "inset(0% 50% 0% 50%)", zIndex: 2 },
        center: { clipPath: SHOWN_CLIP, zIndex: 2 },
        exit: stay,
      };
    case "zoom-in":
      return {
        enter: { opacity: 0, scale: 0.5, zIndex: 2 },
        center: { opacity: 1, scale: 1, zIndex: 2 },
        exit: { opacity: 0, scale: 1.5, zIndex: 1 },
      };
    case "zoom-out":
      return {
        enter: { opacity: 0, scale: 1.5, zIndex: 2 },
        center: { opacity: 1, scale: 1, zIndex: 2 },
        exit: { opacity: 0, scale: 0.5, zIndex: 1 },
      };
    case "cube": {
      const s = dir;
      return {
        enter: { rotateY: 70 * s, x: `${s * 100}%`, originX: s === 1 ? 0 : 1, zIndex: 2 },
        center: { rotateY: 0, x: "0%", zIndex: 2 },
        exit: { rotateY: -70 * s, x: `${-s * 100}%`, originX: s === 1 ? 1 : 0, zIndex: 1 },
      };
    }
    case "morph":
      return {
        enter: { opacity: 0, zIndex: 2 },
        center: { opacity: 1, zIndex: 2 },
        exit: { opacity: 0, zIndex: 1 },
        exitDurationScale: 0.6,
      };
    case "none":
    default:
      return { enter: { opacity: 1, zIndex: 2 }, center: { opacity: 1, zIndex: 2 }, exit: { opacity: 0, zIndex: 1 } };
  }
}

/** The transition that plays when moving from slide `from` to slide `to`. */
export function transitionBetween(
  slides: { transition?: Transition }[],
  from: number,
  to: number,
): SlideMotionContext {
  if (from === to || to < 0 || to >= slides.length) return { transition: { type: "none" }, dir: 1 };
  if (to > from) return { transition: slides[to].transition ?? { type: "none" }, dir: 1 };
  // Going back replays the transition of the slide being left, reversed.
  const leaving = slides[from]?.transition ?? { type: "none" };
  return { transition: leaving, dir: -1 };
}
