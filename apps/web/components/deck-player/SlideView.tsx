/**
 * One slide on its canvas (1920 x 1080, 1440 x 1080 or 1080 x 1080), scaled
 * with `transform: scale`. Used by the editor, previews, the published page and
 * the PDF/PNG/PPTX exports (mode "print" shows everything, no animation).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ElementList, StageContext, type StageContextValue } from "./elements";
import { canvasSize, fitCanvas } from "./geometry";
import type { Box } from "./morph";
import { buildSchedule } from "./steps";
import { deckFamilies, ensureFonts } from "./fonts";
import { colorRef, DEFAULT_TOKENS, fontRef, tokensToStyle } from "./theme";
import type { AssetUrl, CanvasSize, Deck, PlayerMode, Slide, ThemeTokens } from "./types";

export type SlideViewProps = {
  slide: Slide;
  deck: Deck;
  tokens: ThemeTokens;
  /** Canvas scale; when absent the slide fits its container (letterboxed). */
  scale?: number;
  /** Animation step shown (Infinity = everything visible). */
  step?: number;
  mode: "edit" | "present" | "print" | "thumbnail";
  assetUrl: AssetUrl;
};

type Background = NonNullable<Slide["background"]>;

function backgroundStyle(bg: Background | undefined): CSSProperties {
  if (!bg) return { background: colorRef("--bg", "#000") };
  if (bg.type === "color") return { background: colorRef(bg.token) };
  if (bg.type === "gradient") {
    const stops = bg.stops.map((s) => `${colorRef(s.color)} ${Math.round(s.at * 100)}%`).join(", ");
    return { background: `linear-gradient(${bg.angle ?? 180}deg, ${stops})` };
  }
  return { background: colorRef("--bg", "#000") };
}

function BackgroundLayer({ bg, assetUrl }: { bg: Background | undefined; assetUrl: AssetUrl }) {
  if (!bg || bg.type !== "image") return null;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} data-background="image">
      <img src={assetUrl(bg.src)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: bg.fit ?? "cover", display: "block" }} />
      {bg.overlay && <div style={{ position: "absolute", inset: 0, background: colorRef(bg.overlay), opacity: bg.overlayOpacity ?? 0.5 }} />}
    </div>
  );
}

export type SlideCanvasProps = {
  slide: Slide;
  size: CanvasSize;
  tokens: ThemeTokens;
  mode: PlayerMode;
  assetUrl: AssetUrl;
  step?: number;
  morphFrom?: Map<string, Box>;
  morphMs?: number;
  hideIds?: Set<string>;
};

/** The unscaled canvas: background, tokens and elements. */
export function SlideCanvas({ slide, size, tokens, mode, assetUrl, step, morphFrom, morphMs, hideIds }: SlideCanvasProps) {
  const schedule = useMemo(() => buildSchedule(slide), [slide]);
  const effectiveStep = mode === "present" ? (step ?? 0) : Number.POSITIVE_INFINITY;
  const mountStep = useRef(effectiveStep).current;
  const stage: StageContextValue = { mode, assetUrl, schedule, step: effectiveStep, mountStep, morphFrom, morphMs, hideIds };
  // The theme fonts and the families texts name: requested once per page.
  const families = useMemo(() => deckFamilies({ ...DEFAULT_TOKENS, ...tokens }, [slide]).join("|"), [tokens, slide]);
  useEffect(() => ensureFonts(families ? families.split("|") : []), [families]);
  const style: CSSProperties = {
    ...(tokensToStyle({ ...DEFAULT_TOKENS, ...tokens }) as CSSProperties),
    position: "relative",
    width: size.width,
    height: size.height,
    overflow: "hidden",
    color: colorRef("--fg"),
    fontFamily: fontRef("body"),
    ...backgroundStyle(slide.background),
  };
  return (
    <StageContext.Provider value={stage}>
      <div style={style} data-slide-id={slide.id} data-mode={mode} data-step={Number.isFinite(effectiveStep) ? effectiveStep : "all"}>
        <BackgroundLayer bg={slide.background} assetUrl={assetUrl} />
        <ElementList elements={slide.elements} />
      </div>
    </StageContext.Provider>
  );
}

/** Size of an element, kept up to date with a ResizeObserver when available. */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, CanvasSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

export function SlideView({ slide, deck, tokens, scale, step, mode, assetUrl }: SlideViewProps) {
  const size = canvasSize(deck);
  const canvas = <SlideCanvas slide={slide} size={size} tokens={tokens} mode={mode} assetUrl={assetUrl} step={step} />;
  if (scale !== undefined) {
    return (
      <div style={{ position: "relative", width: size.width * scale, height: size.height * scale, overflow: "hidden" }} data-deck-slide="">
        <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{canvas}</div>
      </div>
    );
  }
  return <FittedSlide size={size}>{canvas}</FittedSlide>;
}

/** Fills its parent and centers the scaled canvas in it (bands on one axis). */
export function FittedSlide({ size, children, background }: { size: CanvasSize; children: ReactNode; background?: string }) {
  const [ref, container] = useElementSize<HTMLDivElement>();
  const fit = fitCanvas(container, size);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background }} data-deck-slide="">
      <div
        style={{
          position: "absolute",
          left: fit.left,
          top: fit.top,
          width: fit.width,
          height: fit.height,
          overflow: "hidden",
          visibility: fit.scale > 0 ? "visible" : "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: size.width, height: size.height, transform: `scale(${fit.scale})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
