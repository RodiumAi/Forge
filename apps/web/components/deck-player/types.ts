/**
 * Public types of the deck player. The document types come from the shared
 * Forge Design contract; this file only adds what the player itself needs.
 */

import type { Animation, Deck, Slide, SlideElement, Transition } from "../../lib/contracts/forge-design";

export type { Animation, Deck, Slide, SlideElement, Transition };

/**
 * Theme tokens as CSS custom properties: `{ "--bg": "#0B0D12", "--font-display": "Inter, sans-serif" }`.
 * Keys always start with `--`. Built by `themeTokensFromDesign`.
 */
export type ThemeTokens = Record<string, string>;

/** Resolves a project asset path such as "public/images/x.webp" to a URL. */
export type AssetUrl = (path: string) => string;

export type PlayerMode = "edit" | "present" | "print" | "thumbnail";

export type PlayerLocale = "fr" | "en";

/** Canvas size of a deck format, in canvas pixels. */
export type CanvasSize = { width: number; height: number };
