"use client";

/**
 * "Present": the deck player full screen over the editor, from the current
 * slide. The player brings keyboard and remote control support and its own
 * presenter view button (second window, synced over BroadcastChannel).
 * Leaving full screen or pressing Escape returns to the editor.
 */

import { useEffect, useRef } from "react";
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
  onClose: () => void;
  t: DeckT;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const wasFullscreen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el?.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          wasFullscreen.current = true;
        })
        .catch(() => undefined);
    }
    const onChange = () => {
      if (wasFullscreen.current && !document.fullscreenElement) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="de-present" role="dialog" aria-modal="true" aria-label={t("present")}>
      <DeckPlayer deck={deck} slides={slides} notes={notes} tokens={tokens} assetUrl={assetUrl} startAt={startAt} badge={badge} locale={locale} />
      <button type="button" className="de-present-close" onClick={onClose} aria-label={t("exitPresent")} title={t("exitPresent")}>
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
