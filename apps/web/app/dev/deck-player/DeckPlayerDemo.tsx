"use client";

import { useMemo, useState } from "react";
import { DeckPlayer, SlideView, themeTokensFromDesign } from "@/components/deck-player";
import type { Deck, Slide, SlideElement } from "@/lib/contracts/forge-design";

export type DemoFixtures = {
  deckFull: unknown;
  deckMinimal: unknown;
  deckSquare: unknown;
  designSystem: unknown;
  slides: { full: unknown; minimal: unknown; imageBackground: unknown; groupDepth: unknown };
};

/** Offline stand-in for project images: an SVG naming the requested path. */
function placeholderAsset(path: string): string {
  let hue = 0;
  for (const ch of path) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,25%)"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><text x="800" y="520" font-family="sans-serif" font-size="56" fill="white" text-anchor="middle">${path.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const GRID: Record<string, { x: number; y: number; w: number; h: number }> = {
  box: { x: 80, y: 360, w: 260, h: 180 },
  arrow: { x: 380, y: 400, w: 260, h: 100 },
  ico: { x: 700, y: 360, w: 160, h: 160 },
  tbl: { x: 80, y: 600, w: 560, h: 200 },
  chart: { x: 700, y: 580, w: 560, h: 420 },
  vid: { x: 1320, y: 120, w: 520, h: 292 },
  code: { x: 1320, y: 460, w: 520, h: 260 },
  grp: { x: 1320, y: 780, w: 220, h: 220 },
};

/** The fixture elements, laid out on a grid so each type can be seen. */
function showcase(full: Slide): { deck: Deck; slides: Record<string, Slide>; notes: Record<string, string> } {
  const byId = new Map(full.elements.map((e) => [e.id, e]));
  const title = byId.get("title") as SlideElement;
  const hero = byId.get("hero") as SlideElement;
  const placed: SlideElement[] = full.elements
    .filter((e) => GRID[e.id])
    .map((e) => ({ ...e, ...GRID[e.id] }) as SlideElement);
  const clickChart = placed.map((e) =>
    e.id === "chart" ? ({ ...e, animation: { type: "zoom", trigger: "on-click" } } as SlideElement) : e,
  );
  const s1: Slide = {
    id: "intro",
    background: full.background,
    elements: [
      { ...title, x: 120, y: 80, w: 1100, h: 260, animation: { type: "rise", trigger: "on-enter", durationMs: 600 } } as SlideElement,
      ...clickChart,
    ],
  };
  const s2: Slide = {
    id: "morph",
    background: { type: "color", token: "--bg" },
    elements: [
      { ...title, x: 960, y: 700, w: 900, h: 300, rotation: -4, style: { ...(title.type === "text" ? title.style : {}), size: 56 }, animation: undefined } as SlideElement,
      { ...hero, x: 80, y: 80, w: 820, h: 920, matchKey: "hero-img", animation: undefined } as SlideElement,
      {
        id: "steps",
        type: "text",
        role: "body",
        x: 960,
        y: 120,
        w: 880,
        h: 520,
        content: [{ type: "bullet-list", items: [{ text: "Click 1: typewriter" }, { text: "Then: after previous" }] }],
        style: { size: 44 },
        animation: { type: "typewriter", trigger: "on-click", durationMs: 900 },
      },
      {
        id: "badge",
        type: "shape",
        shape: "ellipse",
        fill: "--accent",
        x: 1700,
        y: 80,
        w: 140,
        h: 140,
        animation: { type: "bounce", trigger: "after-previous", durationMs: 700 },
      },
    ],
  };
  const s3: Slide = {
    id: "back",
    background: { type: "gradient", angle: 90, stops: [{ color: "--accent", at: 0 }, { color: "--bg", at: 1 }] },
    elements: [
      { ...hero, x: 1200, y: 200, w: 600, h: 680, matchKey: "hero-img", animation: undefined } as SlideElement,
      {
        id: "thanks",
        type: "text",
        role: "title",
        x: 120,
        y: 420,
        w: 1000,
        h: 240,
        content: [{ type: "paragraph", text: "Merci !" }],
        style: { size: 140, weight: 800 },
        animation: { type: "pop", trigger: "on-enter" },
      },
    ],
  };
  const deck: Deck = {
    version: 1,
    title: "Showcase",
    format: { ratio: "16:9", width: 1920, height: 1080 },
    theme: { designSystem: "local", tokens: "DESIGN.md" },
    slides: [
      { id: "intro", layout: "title", transition: { type: "fade" } },
      { id: "morph", layout: "two-columns", transition: { type: "cube" } },
      { id: "back", layout: "thanks", transition: { type: "morph", durationMs: 900 } },
    ],
  };
  return {
    deck,
    slides: { intro: s1, morph: s2, back: s3 },
    notes: { intro: "Every element type of slide.full.json.\nNext press: the chart zooms in.", morph: "Cube transition, then click steps.", back: "Morph: the image moves to its new box." },
  };
}

type DeckChoice = "showcase" | "full" | "minimal" | "square";

export function DeckPlayerDemo({ fixtures }: { fixtures: DemoFixtures }) {
  const tokens = useMemo(() => themeTokensFromDesign(JSON.stringify(fixtures.designSystem)), [fixtures.designSystem]);
  const [choice, setChoice] = useState<DeckChoice>("showcase");
  const [view, setView] = useState<"player" | "slides">("player");
  const [badge, setBadge] = useState(true);

  const data = useMemo(() => {
    const full = fixtures.slides.full as Slide;
    if (choice === "showcase") return showcase(full);
    if (choice === "full") {
      return {
        deck: fixtures.deckFull as Deck,
        slides: {
          s1: { ...(fixtures.slides.minimal as Slide), id: "s1" },
          s2: full,
          s3: { ...(fixtures.slides.imageBackground as Slide), id: "s3" },
          s4: { ...(fixtures.slides.groupDepth as Slide), id: "s4" },
        },
        notes: { s1: "Fixture deck.full.json (4:3).", s2: "slide.full.json as is: every element at 0,0." },
      };
    }
    if (choice === "minimal") return { deck: fixtures.deckMinimal as Deck, slides: { s1: fixtures.slides.minimal as Slide }, notes: {} };
    return { deck: fixtures.deckSquare as Deck, slides: {}, notes: {} };
  }, [choice, fixtures]);

  const button = (active: boolean) => ({
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #333",
    background: active ? "#F2620A" : "#1a1d24",
    color: "#fff",
    cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0B0D12", color: "#F5F7FA", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ marginRight: 12 }}>Deck player (dev)</strong>
        {(["showcase", "full", "minimal", "square"] as const).map((c) => (
          <button key={c} type="button" style={button(choice === c)} onClick={() => setChoice(c)}>
            {c}
          </button>
        ))}
        <span style={{ width: 16 }} />
        <button type="button" style={button(view === "player")} onClick={() => setView("player")}>
          player
        </button>
        <button type="button" style={button(view === "slides")} onClick={() => setView("slides")}>
          slide views
        </button>
        <label style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={badge} onChange={(e) => setBadge(e.target.checked)} /> badge
        </label>
      </div>
      {view === "player" ? (
        <div style={{ height: "calc(100vh - 90px)" }}>
          <DeckPlayer key={choice} deck={data.deck} slides={data.slides} notes={data.notes} tokens={tokens} assetUrl={placeholderAsset} badge={badge} />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {data.deck.slides.map((ref) => {
            const slide = (data.slides as Record<string, Slide>)[ref.id];
            if (!slide) return null;
            return (
              <div key={ref.id} style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                {(["edit", "print", "thumbnail"] as const).map((mode) => (
                  <figure key={mode} style={{ margin: 0 }}>
                    <SlideView slide={slide} deck={data.deck} tokens={tokens} mode={mode} scale={mode === "thumbnail" ? 0.12 : 0.25} assetUrl={placeholderAsset} />
                    <figcaption style={{ fontSize: 12, opacity: 0.7 }}>
                      {ref.id} / {mode}
                      {ref.hidden ? " (hidden)" : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
