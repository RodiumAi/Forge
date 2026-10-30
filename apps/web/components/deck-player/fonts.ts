/**
 * Typefaces a deck may use, and loading them in the page.
 *
 * Same list and weights as the API brand charter (brand_charter.GOOGLE_FONTS
 * and design_system.tokens.SELF_HOSTED_FONTS). Self-hosted families are
 * declared by the Forge app's stylesheet and never requested from Google.
 */

import type { Slide, SlideElement, ThemeTokens } from "./types";

export type FontCategory = "sans" | "serif" | "display" | "mono";

/** Curated Google Fonts (same list and weights as the API brand charter). */
export const GOOGLE_FONTS: Record<string, [FontCategory, string]> = {
  Inter: ["sans", "400;500;600;700"],
  Manrope: ["sans", "400;500;600;700"],
  "DM Sans": ["sans", "400;500;600;700"],
  "Plus Jakarta Sans": ["sans", "400;500;600;700"],
  Outfit: ["sans", "400;500;600;700"],
  Sora: ["sans", "400;500;600;700"],
  "Space Grotesk": ["sans", "400;500;600;700"],
  "Work Sans": ["sans", "400;500;600;700"],
  Figtree: ["sans", "400;500;600;700"],
  Onest: ["sans", "400;500;600;700"],
  Urbanist: ["sans", "400;500;600;700"],
  Lexend: ["sans", "400;500;600;700"],
  Rubik: ["sans", "400;500;600;700"],
  "Nunito Sans": ["sans", "400;600;700"],
  "IBM Plex Sans": ["sans", "400;500;600;700"],
  Archivo: ["sans", "400;500;600;700"],
  "Public Sans": ["sans", "400;500;600;700"],
  "Schibsted Grotesk": ["sans", "400;500;600;700"],
  "Bricolage Grotesque": ["sans", "400;500;600;700"],
  "Hanken Grotesk": ["sans", "400;500;600;700"],
  "Instrument Sans": ["sans", "400;500;600;700"],
  "Albert Sans": ["sans", "400;500;600;700"],
  Poppins: ["sans", "400;500;600;700"],
  Nunito: ["sans", "400;600;700"],
  Quicksand: ["sans", "400;500;600;700"],
  Fredoka: ["sans", "400;500;600;700"],
  "Baloo 2": ["sans", "400;500;600;700"],
  Roboto: ["sans", "400;500;700"],
  "Open Sans": ["sans", "400;600;700"],
  Lato: ["sans", "400;700"],
  Montserrat: ["sans", "400;500;600;700"],
  Raleway: ["sans", "400;500;600;700"],
  "Source Sans 3": ["sans", "400;600;700"],
  "Noto Sans": ["sans", "400;500;600;700"],
  Mulish: ["sans", "400;600;700"],
  Barlow: ["sans", "400;500;600;700"],
  Karla: ["sans", "400;500;600;700"],
  "Josefin Sans": ["sans", "400;600;700"],
  "Red Hat Display": ["sans", "400;500;700"],
  Epilogue: ["sans", "400;500;600;700"],
  "Be Vietnam Pro": ["sans", "400;500;600;700"],
  Geist: ["sans", "400;500;600;700"],
  Kanit: ["sans", "400;500;600;700"],
  "Exo 2": ["sans", "400;600;700"],
  "Titillium Web": ["sans", "400;600;700"],
  Cabin: ["sans", "400;500;600;700"],
  Fraunces: ["serif", "400;600;700"],
  "Playfair Display": ["serif", "400;600;700"],
  "Cormorant Garamond": ["serif", "500;600;700"],
  "DM Serif Display": ["serif", "400"],
  Lora: ["serif", "400;500;600;700"],
  Newsreader: ["serif", "400;500;600"],
  "Instrument Serif": ["serif", "400"],
  "EB Garamond": ["serif", "400;500;600"],
  "Source Serif 4": ["serif", "400;600;700"],
  "Bodoni Moda": ["serif", "500;600;700"],
  "Young Serif": ["serif", "400"],
  "Libre Caslon Text": ["serif", "400;700"],
  Merriweather: ["serif", "400;700"],
  "Libre Baskerville": ["serif", "400;700"],
  "Crimson Pro": ["serif", "400;600;700"],
  Spectral: ["serif", "400;600;700"],
  "PT Serif": ["serif", "400;700"],
  "Noto Serif": ["serif", "400;600;700"],
  Bitter: ["serif", "400;600;700"],
  "Roboto Slab": ["serif", "400;600;700"],
  "Zilla Slab": ["serif", "400;600;700"],
  Cormorant: ["serif", "500;600;700"],
  "DM Serif Text": ["serif", "400"],
  Gloock: ["serif", "400"],
  Syne: ["display", "500;600;700;800"],
  Unbounded: ["display", "500;600;700"],
  "Bebas Neue": ["display", "400"],
  Anton: ["display", "400"],
  "Archivo Black": ["display", "400"],
  Oswald: ["display", "400;500;600;700"],
  Teko: ["display", "400;500;600"],
  "Chakra Petch": ["display", "400;500;600;700"],
  Orbitron: ["display", "400;500;600;700"],
  Righteous: ["display", "400"],
  "Abril Fatface": ["display", "400"],
  "Alfa Slab One": ["display", "400"],
  Bungee: ["display", "400"],
  Lobster: ["display", "400"],
  Pacifico: ["display", "400"],
  Caveat: ["display", "400;600;700"],
  "Dancing Script": ["display", "400;600;700"],
  "Permanent Marker": ["display", "400"],
  "Press Start 2P": ["display", "400"],
  "Space Mono": ["mono", "400;700"],
  "JetBrains Mono": ["mono", "400;500;700"],
  "IBM Plex Mono": ["mono", "400;500;600"],
  "Fira Code": ["mono", "400;500;600;700"],
  "Roboto Mono": ["mono", "400;500;700"],
  "Source Code Pro": ["mono", "400;600;700"],
  "DM Mono": ["mono", "400;500"],
  "Geist Mono": ["mono", "400;500;600;700"],
  Inconsolata: ["mono", "400;600;700"],
};


/** Families Forge serves itself (category, weights). */
export const SELF_HOSTED_FONTS: Record<string, [FontCategory, string]> = {
  "Open Sauce Sans": ["sans", "400;500;600;700"],
};

/** Every family the editor offers, by category, alphabetical. */
export function fontChoices(): Record<FontCategory, string[]> {
  const out: Record<FontCategory, string[]> = { sans: [], serif: [], display: [], mono: [] };
  for (const [name, [category]] of Object.entries({ ...SELF_HOSTED_FONTS, ...GOOGLE_FONTS })) out[category].push(name);
  for (const list of Object.values(out)) list.sort((a, b) => a.localeCompare(b));
  return out;
}

/** First family of a CSS font stack, unquoted ("\"DM Sans\", sans-serif" to "DM Sans"). */
export function firstFamily(stack: string | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "").trim();
  return first && !first.startsWith("var(") ? first : null;
}

function walkFamilies(elements: SlideElement[], out: Set<string>) {
  for (const element of elements) {
    const family = (element as { style?: { family?: string } }).style?.family;
    if (family) out.add(family);
    if (element.type === "group") walkFamilies(element.children, out);
  }
}

/** Families a slide set and its theme render with: theme roles first, then explicit text families. */
export function deckFamilies(tokens: ThemeTokens, slides: Slide[]): string[] {
  const out = new Set<string>();
  for (const role of ["--font-display", "--font-body", "--font-mono"]) {
    const family = firstFamily(tokens[role]);
    if (family) out.add(family);
  }
  for (const slide of slides) walkFamilies(slide.elements, out);
  return [...out];
}

/** Google Fonts stylesheet for the catalog families among `families` (others are skipped). */
export function googleFontsHref(families: string[]): string | null {
  const parts = [...new Set(families)]
    .filter((family) => GOOGLE_FONTS[family])
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${GOOGLE_FONTS[family][1]}`);
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap` : null;
}

const requested = new Set<string>();

/** Adds the Google Fonts stylesheets of the families not requested yet in this page. */
export function ensureFonts(families: string[]): void {
  if (typeof document === "undefined") return;
  const wanted = families.filter((family) => GOOGLE_FONTS[family] && !requested.has(family));
  for (const family of wanted) {
    requested.add(family);
    // One link per family: css2 fails the whole request when one family lacks a weight.
    const href = googleFontsHref([family]);
    if (!href || document.querySelector(`link[data-deck-font="${family}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.deckFont = family;
    document.head.appendChild(link);
  }
}
