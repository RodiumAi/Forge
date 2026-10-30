"use client";

/**
 * "Present": the deck player full screen over the editor, from the current
 * slide. The player brings keyboard and remote control support and its own
 * presenter view button (second window, synced over BroadcastChannel).
 * Leaving full screen or pressing Escape returns to the editor, on the slide
 * the presentation stopped at, so presenting again resumes there.
 * In presenter view the presenter window opens at once and the audience view
 * stays in the tab, ready to be moved to the projector.
 */

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { DeckPlayer, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import type { DeckLocale, DeckT } from "./strings";

/** Index of `slideId` among the slides shown when presenting (hidden ones are skipped). */
export function presentIndex(deck: Deck, slideId: string | null): number {
  const visible = deck.slides.filter((ref) => !ref.hidden);
  const all = deck.slides.findIndex((ref) => ref.id === slideId);
  if (all < 0) return 0;
  const next = deck.slides.slice(all).find((ref) => !ref.hidden);
  const index = next ? visible.findIndex((ref) => ref.id === next.id) : visible.length - 1;
  return Math.max(0, index);
}

export function PresentOverlay({
  deck,
  slides,
  notes,
  tokens,
  assetUrl,
  startAt,
  badge,
  locale,
  presenterView = false,
  onClose,
  t,
}: {
  deck: Deck;
  slides: Record<string, Slide>;
  notes: Record<string, string>;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  startAt: number;
  badge: boolean;
  locale: DeckLocale;
  /** Open the presenter view (notes, next slide, timer) in a second window. */
  presenterView?: boolean;
  /** Called with the id of the slide on screen when the presentation ends. */
  onClose: (slideId: string | null) => void;
  t: DeckT;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const wasFullscreen = useRef(false);
  const last = useRef(startAt);
  const latest = useRef({ deck, onClose });
  latest.current = { deck, onClose };
  const close = useCallback(() => {
    const visible = latest.current.deck.slides.filter((slide) => !slide.hidden);
    latest.current.onClose(visible[last.current]?.id ?? null);
  }, []);
  const track = useCallback((index: number) => {
    last.current = index;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!presenterView && el?.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          wasFullscreen.current = true;
        })
        .catch(() => undefined);
    }
    const onChange = () => {
      if (wasFullscreen.current && !document.fullscreenElement) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) close();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => undefined);
    };
  }, [close, presenterView]);

  return (
    <div ref={ref} className="de-present" role="dialog" aria-modal="true" aria-label={t("present")}>
      <DeckPlayer deck={deck} slides={slides} notes={notes} tokens={tokens} assetUrl={assetUrl} startAt={startAt} badge={badge} locale={locale} presenterOnStart={presenterView} onSlideChange={track} />
      <button type="button" className="de-present-close" onClick={close} aria-label={t("exitPresent")} title={t("exitPresent")}>
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
