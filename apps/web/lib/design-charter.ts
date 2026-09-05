/**
 * Pure DESIGN.md / CSS token helpers for the charter panel.
 *
 * Swatches used to be read-only previews. Color pickers rewrite the same
 * `--token: #hex` literals in DESIGN.md and (when present) `src/index.css`.
 */

export type CharterPalette = { name: string; hex: string };

const COLOR_LINE_RE = /--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOKEN_NAME_RE = /^[a-z][a-z0-9-]*$/;
const MAX_PALETTE = 16;

/** Expand #rgb / #rrggbb / #rrggbbaa to a 6-digit #rrggbb for <input type="color">. */
export function hexForColorInput(hex: string): string {
  const h = (hex || "").trim().toLowerCase();
  if (!HEX_RE.test(h)) return "#000000";
  const body = h.slice(1);
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  if (body.length === 8) return `#${body.slice(0, 6)}`;
  return `#${body.slice(0, 6)}`;
}

export function normalizeHex(hex: string): string | null {
  const h = (hex || "").trim().toLowerCase();
  if (!HEX_RE.test(h)) return null;
  return hexForColorInput(h);
}

export function isTokenName(name: string): boolean {
  return TOKEN_NAME_RE.test(name);
}

/** Ordered, deduplicated palette entries found anywhere in the markdown/CSS. */
export function parseCharterPalette(markdown: string | null | undefined): CharterPalette[] {
  if (!markdown) return [];
  const seen = new Set<string>();
  const out: CharterPalette[] = [];
  for (const match of markdown.matchAll(COLOR_LINE_RE)) {
    const name = match[1].toLowerCase();
    const hex = normalizeHex(match[2]);
    if (!hex || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, hex });
    if (out.length >= MAX_PALETTE) break;
  }
  return out;
}

/**
 * Merge DESIGN.md palette with `:root` CSS tokens (md first, then CSS-only).
 * Strips a leading `color-` duplicate when both `--accent` and `--color-accent` exist.
 */
export function mergePalettes(md: CharterPalette[], css: CharterPalette[]): CharterPalette[] {
  const byName = new Map<string, string>();
  for (const c of md) byName.set(c.name, c.hex);
  for (const c of css) {
    if (!byName.has(c.name)) byName.set(c.name, c.hex);
  }
  // Prefer short names when both accent and color-accent exist with same hex.
  for (const name of [...byName.keys()]) {
    if (!name.startsWith("color-")) continue;
    const short = name.slice("color-".length);
    if (short && byName.has(short)) byName.delete(name);
  }
  const out: CharterPalette[] = [];
  for (const [name, hex] of byName) {
    out.push({ name, hex });
    if (out.length >= MAX_PALETTE) break;
  }
  return out;
}

/** Replace every `--name: #…` (and `--color-name` twin) occurrence in text. */
export function replaceTokenHex(source: string, name: string, hex: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized || !isTokenName(name) || !source) return source;
  const names = new Set<string>([name]);
  if (name.startsWith("color-")) names.add(name.slice("color-".length));
  else names.add(`color-${name}`);

  let next = source;
  for (const token of names) {
    if (!isTokenName(token)) continue;
    const re = new RegExp(`(--${token}\\s*:\\s*)(#[0-9a-fA-F]{3,8})\\b`, "gi");
    next = next.replace(re, `$1${normalized}`);
  }
  return next;
}

export function replaceCharterColor(
  markdown: string,
  name: string,
  hex: string,
): string {
  return replaceTokenHex(markdown, name, hex);
}

export function replaceCssRootColor(css: string, name: string, hex: string): string {
  return replaceTokenHex(css, name, hex);
}

/** First paragraph under a "## Tone" / "## Ton" heading, if any. */
export function parseCharterTone(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const match = markdown.match(/^##\s+Ton(?:e|alité)?\s*\r?\n+([^\n#][^\n]*)/im);
  const tone = match?.[1]?.trim();
  return tone || null;
}
