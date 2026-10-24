/**
 * Print page: every visible slide at canvas size, one page each (or one per
 * animation step). The PDF prints it, the PNG export screenshots each page,
 * the PPTX export reads its boxes and styles.
 */

import { buildSchedule, canvasSize, SlideView } from "@forge/deck-player";
import type { Deck, Slide, SlideElement } from "@forge/deck-player/types";

type Props = {
  deck: Deck;
  slides: Record<string, Slide>;
  tokens: Record<string, string>;
  assetUrl: (path: string) => string;
  steps: boolean;
};

/** The slide as shown after `step` clicks: elements that appear later are left out. */
export function slideAtStep(slide: Slide, step: number): Slide {
  const schedule = buildSchedule(slide);
  const keep = (elements: SlideElement[]): SlideElement[] =>
    elements
      .filter((el) => {
        const entry = schedule.entries.get(el.id);
        return !entry || entry.step <= step;
      })
      .map((el) => (el.type === "group" ? { ...el, children: keep(el.children) } : el))
      .filter((el) => el.type !== "group" || el.children.length > 0);
  return { ...slide, elements: keep(slide.elements) };
}

export type PrintPage = { key: string; slide: Slide; step: number | null };

export function printPages(deck: Deck, slides: Record<string, Slide>, steps: boolean): PrintPage[] {
  const pages: PrintPage[] = [];
  for (const ref of deck.slides) {
    if (ref.hidden) continue;
    const slide = slides[ref.id] ?? { id: ref.id, elements: [] };
    if (!steps) {
      pages.push({ key: ref.id, slide, step: null });
      continue;
    }
    const count = buildSchedule(slide).steps;
    for (let k = 0; k <= count; k++) pages.push({ key: `${ref.id}:${k}`, slide: slideAtStep(slide, k), step: k });
  }
  return pages;
}

export function PrintPages({ deck, slides, tokens, assetUrl, steps }: Props) {
  const size = canvasSize(deck);
  const pages = printPages(deck, slides, steps);
  // contain: an element overflowing its slide (clipped on screen) would
  // otherwise make Chromium shrink every printed page to fit it.
  const css = `@page { size: ${size.width}px ${size.height}px; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
[data-print-page] { break-after: page; page-break-after: always; contain: strict; }
[data-print-page]:last-child { break-after: auto; page-break-after: auto; }`;
  return (
    <>
      <style>{css}</style>
      {pages.map((page, i) => (
        <section
          key={page.key}
          data-print-page={i}
          data-page-slide={page.slide.id}
          {...(page.step !== null ? { "data-page-step": page.step } : {})}
          style={{ position: "relative", width: size.width, height: size.height, overflow: "hidden" }}
        >
          <SlideView slide={page.slide} deck={deck} tokens={tokens} scale={1} mode="print" assetUrl={assetUrl} />
        </section>
      ))}
    </>
  );
}
