"use client";

import { useState } from "react";
import { DeckEditor } from "@/components/deck-editor/DeckEditor";
import type { ChatClient, StreamHandler } from "@/components/deck-editor/chat-client";
import { slideFromLayout } from "@/components/deck-editor/layouts";
import { MemoryDocServer } from "@/components/deck-editor/memory-transport";
import type { DeckPublisher } from "@/components/deck-editor/PublishMenu";
import type { ImportedSlide, SlideImport, SlideImportClient } from "@/components/deck-editor/slide-import";
import { copyFor } from "@/components/deck-editor/strings";
import type { Deck, Slide } from "@/lib/contracts/forge-design";

/** Offline stand-in for project images: an SVG naming the requested path. */
function placeholderAsset(path: string): string {
  let hue = 0;
  for (const ch of path) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="hsl(${hue},60%,40%)"/><text x="800" y="520" font-family="sans-serif" font-size="56" fill="white" text-anchor="middle">${path.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function demoDoc(): { deck: Deck; slides: Record<string, Slide> } {
  const copy = copyFor("fr");
  const layouts = ["title", "two-columns", "key-numbers", "image-text", "chart", "thanks"] as const;
  const slides: Record<string, Slide> = {};
  const refs: Deck["slides"] = [];
  layouts.forEach((layout, i) => {
    const id = `s${i + 1}`;
    slides[id] = slideFromLayout(id, layout, "16:9", copy);
    refs.push({ id, layout, transition: i === 0 ? undefined : { type: "fade", durationMs: 500 } });
  });
  slides.s4.elements = slides.s4.elements.map((el) =>
    el.id === "image" ? { id: "image", type: "image", x: el.x, y: el.y, w: el.w, h: el.h, src: "public/images/demo.webp", fit: "cover", credit: { source: "pixabay", author: "Demo" } } : el,
  );
  return {
    deck: { version: 1, title: "Démo de l'éditeur", format: { ratio: "16:9", width: 1920, height: 1080 }, theme: { designSystem: "local", tokens: "design-system.json" }, slides: refs },
    slides,
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Offline stand-in for the PowerPoint import: a conversion set on
 * `window.__forgeSlideImport` (a server response) when there is one, else a
 * few slides drawn from the layouts.
 */
const demoSlideImport: SlideImportClient = {
  importPptx: async () => {
    await wait(400);
    const preset = (window as { __forgeSlideImport?: SlideImport }).__forgeSlideImport;
    if (preset) return preset;
    const copy = copyFor("fr");
    const slides = (["title", "quote", "key-numbers"] as const).map((layout, i): ImportedSlide => ({
      index: i + 1,
      title: layout,
      hidden: false,
      slide: { ...slideFromLayout(`imported-${i + 1}`, layout, "16:9", copy), background: { type: "color" as const, token: "#1C1F26" } },
      notes: `Notes de la slide ${i + 1}.`,
      warnings: i === 1 ? { shape_approximated: 2 } : ({} as Record<string, number>),
    }));
    return { canvas: { width: 1920, height: 1080 }, slides, warnings: {} };
  },
};

/**
 * A fake AI: a targeted message rewrites the target slide's title (and warns
 * TARGET_SCOPE when an element was targeted), a deck message adds a slide.
 */
function fakeChat(server: MemoryDocServer): ChatClient {
  let counter = 0;
  return {
    messages: async () => [],
    active: async () => null,
    send: async (body, onEvent: StreamHandler) => {
      const runId = `run-${++counter}`;
      onEvent({ type: "user_message", run_id: runId });
      onEvent({ type: "step", id: "deck_edit", label: "Rédaction...", status: "running" });
      await wait(600);
      if (body.target) {
        const sid = body.target.slideId;
        const current = server.slides.get(sid)?.value;
        if (current) {
          const slide: Slide = {
            ...current,
            elements: current.elements.map((el) =>
              el.type === "text" && el.role === "title" ? { ...el, content: [{ type: "paragraph", text: `${body.content} (IA)` }] } : el,
            ),
          };
          server.externalSlide(slide);
          if (body.target.elementId) {
            onEvent({ type: "warning", message: "TARGET_SCOPE: title", violation: { code: "TARGET_SCOPE", path: `slides/${sid}.json` } });
          }
          onEvent({ type: "deck.slide", run_id: runId, slide_id: sid, index: 0, total: 1, slide, notes: `Notes écrites par l'IA pour ${sid}.`, fallback: false, target: body.target });
        }
      } else {
        const deck = server.deck.value;
        const id = `ai${counter}`;
        const slide = slideFromLayout(id, "quote", deck.format.ratio, copyFor("fr"));
        const next: Deck = { ...deck, slides: [...deck.slides, { id, layout: "quote" }] };
        server.externalDeck(next);
        server.externalSlide(slide);
        onEvent({ type: "deck.deck", run_id: runId, deck: next });
        onEvent({ type: "deck.slide", run_id: runId, slide_id: id, index: 0, total: 1, slide, fallback: true });
        onEvent({ type: "warning", message: `SLIDE_FALLBACK: ${id}`, violation: { code: "SLIDE_FALLBACK", path: `slides/${id}.json` } });
      }
      onEvent({ type: "deck.done", run_id: runId, slides: [], warnings: [] });
      onEvent({ type: "done", summary: "Présentation mise à jour (démo)." });
    },
    confirm: async () => undefined,
    subscribe: async () => undefined,
    cancel: async () => undefined,
  };
}

const demoPublisher: DeckPublisher = {
  badgeRemovable: true,
  publish: async (options) => {
    await wait(700);
    (window as unknown as { __deckPublished?: unknown }).__deckPublished = options;
    return { public_url: "https://demo.forge.example/" };
  },
  presenterUrl: (url) => `${url.replace(/\/+$/, "")}/presenter/`,
};

let demo: { server: MemoryDocServer; transport: ReturnType<MemoryDocServer["transport"]>; chat: ChatClient } | null = null;

/** One in-memory document per page load (exposed as `window.__deckServer` for checks). */
function getDemo() {
  if (!demo) {
    const doc = demoDoc();
    const server = new MemoryDocServer(doc.deck, doc.slides, { s1: "Accueillir le public." });
    demo = { server, transport: server.transport(), chat: fakeChat(server) };
    if (typeof window !== "undefined") (window as unknown as { __deckServer: MemoryDocServer }).__deckServer = server;
  }
  return demo;
}

export function DeckEditorDemo({ designSystem }: { designSystem: string }) {
  const [{ transport, chat }] = useState(getDemo);
  return (
    <DeckEditor
      projectId="demo"
      projectName="Démo"
      transport={transport}
      loadTheme={async () => designSystem}
      assetUrl={placeholderAsset}
      chat={chat}
      images={null}
      slideImport={demoSlideImport}
      badgeRemovable
      publisher={demoPublisher}
      backHref="/dev/deck-player"
    />
  );
}
