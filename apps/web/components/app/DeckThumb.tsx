"use client";

/**
 * Live cover of a presentation: the first visible slide drawn with the deck
 * player, cropped to fill the 16:10 project thumbnail. Decks store no JPEG
 * capture, so the dashboard and project cards render the slide itself.
 */

import { useEffect, useRef, useState } from "react";
import { canvasSize, DEFAULT_TOKENS, SlideView, themeTokensFromDesign, type ThemeTokens } from "@/components/deck-player";
import { documentTransport, readProjectFile } from "@/components/deck-editor/transport";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { projectPublicUrl } from "@/lib/asset-url";
import { useMediaToken } from "@/lib/media-token";

type Cover = { deck: Deck; slide: Slide; tokens: ThemeTokens };

// One fetch per project version, shared by every card on the page.
const covers = new Map<string, Promise<Cover | null>>();

function loadCover(projectId: string, version: string): Promise<Cover | null> {
  const key = `${projectId}:${version}`;
  let pending = covers.get(key);
  if (!pending) {
    const transport = documentTransport(projectId);
    pending = (async () => {
      const deck = (await transport.getDeck()).value;
      const ref = deck.slides.find((s) => !s.hidden) ?? deck.slides[0];
      if (!ref) return null;
      const [slide, design] = await Promise.all([
        transport.getSlide(ref.id).then((r) => r.value),
        readProjectFile(projectId, deck.theme.tokens ?? "DESIGN.md").catch(() => null),
      ]);
      return { deck, slide, tokens: design ? themeTokensFromDesign(design) : DEFAULT_TOKENS };
    })().catch(() => null);
    covers.set(key, pending);
  }
  return pending;
}

/** Renders nothing until the slide is loaded; `onMissing` lets the caller keep its placeholder. */
export function DeckThumb({ projectId, version, onMissing }: { projectId: string; version: string; onMissing?: () => void }) {
  const [cover, setCover] = useState<Cover | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const mediaToken = useMediaToken();
  const missingRef = useRef(onMissing);
  missingRef.current = onMissing;

  useEffect(() => {
    let alive = true;
    void loadCover(projectId, version).then((c) => {
      if (!alive) return;
      if (c) setCover(c);
      else missingRef.current?.();
    });
    return () => {
      alive = false;
    };
  }, [projectId, version]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const assetUrl = (path: string) => {
    void mediaToken;
    return projectPublicUrl(projectId, path) ?? "";
  };

  let inner = null;
  if (cover && box && box.w > 0) {
    const size = canvasSize(cover.deck);
    // Cover fit: fill the card, crop the overflow evenly.
    const scale = Math.max(box.w / size.width, box.h / size.height);
    const left = (box.w - size.width * scale) / 2;
    const top = (box.h - size.height * scale) / 2;
    inner = (
      <div style={{ position: "absolute", left, top }}>
        <SlideView slide={cover.slide} deck={cover.deck} tokens={cover.tokens} mode="thumbnail" scale={scale} assetUrl={assetUrl} />
      </div>
    );
  }

  return (
    <div ref={ref} className="f-deck-thumb" aria-hidden>
      {inner}
    </div>
  );
}
