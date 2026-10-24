/**
 * One-click motion presets (plan 5.3) and "apply to all slides".
 *
 * - Sobre: fade between slides, text fades in on arrival.
 * - Dynamique: push between slides, the title rises first and the rest
 *   follows one after the other.
 * - Élégant: morph between slides (titles share a match key so they glide
 *   from one slide to the next), text revealed by a mask.
 */

import type { Animation, Slide, SlideElement, Transition } from "@/lib/contracts/forge-design";
import type { Doc } from "./model";

export const PRESETS = ["sober", "dynamic", "elegant"] as const;
export type PresetId = (typeof PRESETS)[number];

const TRANSITIONS: Record<PresetId, Transition> = {
  sober: { type: "fade", durationMs: 500 },
  dynamic: { type: "push", direction: "left", durationMs: 600 },
  elegant: { type: "morph", durationMs: 900, easing: "ease-in-out" },
};

function isTitle(element: SlideElement): boolean {
  return element.type === "text" && (element.role === "title" || element.role === "heading");
}

function animationFor(preset: PresetId, element: SlideElement, order: number): Animation | undefined {
  if (element.type !== "text") return undefined;
  if (preset === "sober") return { type: "appear", trigger: "on-enter", durationMs: 500, order };
  if (preset === "dynamic") {
    return isTitle(element)
      ? { type: "rise", trigger: "on-enter", durationMs: 500, order }
      : { type: "rise", trigger: "after-previous", durationMs: 450, order };
  }
  return isTitle(element) ? undefined : { type: "mask-reveal", trigger: "on-enter", durationMs: 700, order };
}

function presetSlide(preset: PresetId, slide: Slide): Slide {
  const texts = slide.elements
    .filter((e) => e.type === "text")
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((e) => e.id);
  const elements = slide.elements.map((element) => {
    const order = texts.indexOf(element.id);
    const animation = animationFor(preset, element, Math.max(0, order));
    const next = { ...element } as SlideElement;
    if (animation) next.animation = animation;
    else if (element.type === "text") delete next.animation;
    if (preset === "elegant" && isTitle(element) && element.type === "text" && element.role === "title") next.matchKey = "title";
    return next;
  });
  return { ...slide, elements };
}

/** Apply a preset to every slide: transitions and element animations. */
export function applyPreset(doc: Doc, preset: PresetId): Doc {
  const slides: Record<string, Slide> = { ...doc.slides };
  for (const ref of doc.deck.slides) {
    const slide = doc.slides[ref.id];
    if (slide) slides[ref.id] = presetSlide(preset, slide);
  }
  return {
    deck: { ...doc.deck, slides: doc.deck.slides.map((ref) => ({ ...ref, transition: { ...TRANSITIONS[preset] } })) },
    slides,
  };
}

/** Give every slide the same transition. */
export function applyTransitionToAll(doc: Doc, transition: Transition | undefined): Doc {
  return {
    ...doc,
    deck: {
      ...doc.deck,
      slides: doc.deck.slides.map((ref) => {
        const next = { ...ref };
        if (transition) next.transition = { ...transition };
        else delete next.transition;
        return next;
      }),
    },
  };
}
