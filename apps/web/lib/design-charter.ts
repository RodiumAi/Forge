/**
 * Pure DESIGN.md parsing for the charter panel.
 *
 * The charter used to render only as a raw markdown textarea: for template
 * forks (empty brief, no logo) the panel looked completely empty even though
 * the kit shipped a full charter. Swatches + tone give it a visible identity.
 */

export type CharterPalette = { name: string; hex: string };

const COLOR_LINE_RE = /--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Ordered, deduplicated palette entries found anywhere in the markdown. */
export function parseCharterPalette(markdown: string | null | undefined): CharterPalette[] {
  if (!markdown) return [];
  const seen = new Set<string>();
  const out: CharterPalette[] = [];
  for (const match of markdown.matchAll(COLOR_LINE_RE)) {
    const name = match[1].toLowerCase();
    const hex = match[2].toLowerCase();
    if (seen.has(name) || !HEX_RE.test(hex)) continue;
    seen.add(name);
    out.push({ name, hex });
    if (out.length >= 8) break;
  }
  return out;
}

/** First paragraph under a "## Tone" / "## Ton" heading, if any. */
export function parseCharterTone(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const match = markdown.match(/^##\s+Ton(?:e|alité)?\s*\r?\n+([^\n#][^\n]*)/im);
  const tone = match?.[1]?.trim();
  return tone || null;
}
