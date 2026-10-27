"use client";

import { useEffect, useRef, useState } from "react";

import { SlideView } from "@/components/deck-player";
import { loadTemplateDeck, type TemplateDeck } from "@/lib/template-deck";

/** Slide interval while a card plays (mockup: 1.1 s). */
export const DECK_AUTOPLAY_MS = 1100;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * A slides template drawn with the real deck player (thumbnail mode). Loads the
 * deck when the card scrolls near the viewport. While `playing`, it advances a
 * slide every 1.1 s and reports the index; it goes back to the first slide when
 * stopped. Returns null when the deck cannot be loaded so the caller can fall
 * back to the static preview.
 */
export function DeckThumb({
  templateId,
  playing,
  onIndex,
  onCount,
  onMissing,
}: {
  templateId: string;
  playing: boolean;
  onIndex?: (index: number) => void;
  onCount?: (count: number) => void;
  /** The deck could not be loaded (old API, kind switched off). */
  onMissing?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [data, setData] = useState<TemplateDeck | null>(null);
  const [index, setIndex] = useState(0);
  const missingRef = useRef(onMissing);
  missingRef.current = onMissing;
  const countRef = useRef(onCount);
  countRef.current = onCount;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let alive = true;
    void loadTemplateDeck(templateId).then((deck) => {
      if (!alive) return;
      if (!deck) {
        missingRef.current?.();
        return;
      }
      setData(deck);
      countRef.current?.(deck.slides.length);
    });
    return () => {
      alive = false;
    };
  }, [near, templateId]);

  useEffect(() => {
    if (!data) return;
    if (!playing || reducedMotion()) {
      setIndex(0);
      return;
    }
    const n = data.slides.length;
    const first = window.setTimeout(() => setIndex((i) => (i + 1) % n), 350);
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % n), DECK_AUTOPLAY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [playing, data]);

  useEffect(() => {
    onIndex?.(index);
  }, [index, onIndex]);

  const slide = data?.slides[index % Math.max(1, data.slides.length)];
  return (
    <div ref={hostRef} className="f-deck-thumb" aria-hidden>
      {data && slide ? (
        <div key={slide.id} className={index === 0 && !playing ? "f-deck-slide" : "f-deck-slide is-in"}>
          <SlideView slide={slide} deck={data.deck} tokens={data.tokens} mode="thumbnail" assetUrl={data.assetUrl} />
        </div>
      ) : (
        <div className="f-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />
      )}
    </div>
  );
}
