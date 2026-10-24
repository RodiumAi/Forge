/**
 * Codelab theme: the design system tokens (same reading as the deck player)
 * plus the light or dark syntax palette that matches the background.
 */

import { themeTokensFromDesign } from "../deck-player/theme";
import type { ThemeTokens } from "../deck-player/types";

export type ColorScheme = "light" | "dark";

function hexToRgb(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function rgbFunction(value: string): [number, number, number] | null {
  const match = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Relative luminance (WCAG) of a CSS colour, or null when it is not a plain colour. */
export function luminance(color: string): number | null {
  const rgb = hexToRgb(color) ?? rgbFunction(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark when the background is dark; unknown backgrounds count as light. */
export function schemeOf(tokens: ThemeTokens): ColorScheme {
  const value = luminance(tokens["--bg"] ?? "");
  return value !== null && value < 0.35 ? "dark" : "light";
}

/**
 * The DESIGN.md written by Forge (`design_md_from_design_system`, the kits)
 * quotes token names in backticks ("- `--bg`: #fff") and lists fonts as
 * "- display: Inter". Both are normalized before the deck player's reader,
 * which expects bare "--bg: #fff" lines and "Display font: Inter".
 */
export function normalizeDesignMarkdown(md: string): string {
  if ((md ?? "").trim().startsWith("{")) return md;
  return (md ?? "")
    .replace(/`(--[A-Za-z0-9-]{1,48})`/g, "$1")
    .replace(/^(\s*[-*]\s*)(display|body|mono|heading|code)\s*:\s*/gim, (_, bullet: string, role: string) => {
      const label = /mono|code/i.test(role) ? "Mono" : /display|heading/i.test(role) ? "Display" : "Body";
      return `${bullet}${label} font: `;
    });
}

const FONT_FALLBACKS: Record<string, string> = {
  "--font-display": 'system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-body": 'system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-mono": 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
};

/** A charter naming one family ("Inter") still falls back to a font of the right kind. */
export function withFontFallbacks(tokens: ThemeTokens): ThemeTokens {
  const out = { ...tokens };
  for (const [name, fallback] of Object.entries(FONT_FALLBACKS)) {
    const value = (out[name] ?? "").trim();
    if (value && !/(serif|monospace|system-ui)\s*$/i.test(value)) out[name] = `${value}, ${fallback}`;
  }
  return out;
}

export function codelabTokens(design: string): { tokens: ThemeTokens; scheme: ColorScheme } {
  const tokens = withFontFallbacks(themeTokensFromDesign(normalizeDesignMarkdown(design)));
  return { tokens, scheme: schemeOf(tokens) };
}
