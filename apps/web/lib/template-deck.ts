"use client";

/**
 * The deck of a slides template (GET /templates/{id}/deck), for the gallery
 * cards that play it on hover. One request per template per page load; theme
 * tokens are derived once from the kit's DESIGN.md.
 */

import { themeTokensFromDesign, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide } from "@/components/deck-player/types";
import { googleFontsHref } from "@/components/design-system/tokens";
import { apiBase } from "@/lib/api";

export type TemplateDeck = {
  deck: Deck;
  slides: Slide[];
  tokens: ThemeTokens;
  /** Maps "public/images/x.webp" onto the template media route. */
  assetUrl: (path: string) => string;
};

const cache = new Map<string, Promise<TemplateDeck | null>>();
const loadedFonts = new Set<string>();

function firstFamily(stack: string | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || null;
}

/** Adds the deck's display and body fonts (curated Google families only). */
function loadDeckFonts(tokens: ThemeTokens) {
  if (typeof document === "undefined") return;
  const families = [firstFamily(tokens["--font-display"]), firstFamily(tokens["--font-body"])].filter(
    (f): f is string => Boolean(f) && !loadedFonts.has(f as string),
  );
  if (!families.length) return;
  const href = googleFontsHref(families);
  families.forEach((f) => loadedFonts.add(f));
  if (!href) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function loadTemplateDeck(templateId: string): Promise<TemplateDeck | null> {
  let flight = cache.get(templateId);
  if (!flight) {
    const base = apiBase();
    flight = fetch(`${base}/templates/${encodeURIComponent(templateId)}/deck`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { deck?: Deck; slides?: Slide[]; design?: string } | null) => {
        if (!body?.deck || !Array.isArray(body.slides) || !body.slides.length) return null;
        const tokens = themeTokensFromDesign(body.design || "");
        loadDeckFonts(tokens);
        const media = `${base}/templates/${encodeURIComponent(templateId)}/media/`;
        return {
          deck: body.deck,
          slides: body.slides,
          tokens,
          assetUrl: (path: string) => {
            if (/^(https?:|data:|blob:)/.test(path)) return path;
            return media + path.replace(/^\.?\//, "").replace(/^public\//, "");
          },
        } satisfies TemplateDeck;
      })
      .catch(() => null);
    cache.set(templateId, flight);
  }
  return flight;
}
