/**
 * Pure helpers over a design-system.json document (W3C tokens), used by the
 * editor sections. Every setter returns a new document; nothing is mutated.
 *
 * Mirrors `apps/api/app/services/design_system/tokens.py`: same colour roles,
 * same contrast pairs, same type scale steps, so what the editor shows is what
 * the API checks and writes.
 */

import { GOOGLE_FONTS, SELF_HOSTED_FONTS, type FontCategory } from "@/components/deck-player/fonts";
import { tokensFromDesignSystem } from "@/components/deck-player/theme";
import type { DesignSystem } from "@/lib/contracts/forge-design";

type Json = Record<string, unknown>;
export type DesignSystemDoc = DesignSystem;

export const SECTIONS = [
  "colors",
  "typography",
  "spacing",
  "logo",
  "iconography",
  "imagery",
  "voice",
  "guidelines",
  "components",
] as const;
export type SectionId = (typeof SECTIONS)[number];

export const MISUSE_PREFIX = "Avoid: ";
export const SHOWCASE = ["button", "input", "card", "badge", "alert", "table"] as const;

export const COLOR_ROLES = [
  "bg",
  "surface",
  "fg",
  "muted",
  "accent",
  "accent-contrast",
  "secondary",
  "border",
  "success",
  "warning",
  "danger",
  "info",
] as const;

/** (foreground, background, minimum ratio). Same list and order as the API. */
export const CONTRAST_PAIRS: readonly [string, string, number][] = [
  ["fg", "bg", 4.5],
  ["fg", "surface", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["accent", "bg", 3],
  ["accent-contrast", "accent", 4.5],
  ["success", "bg", 3],
  ["warning", "bg", 3],
  ["danger", "bg", 3],
  ["info", "bg", 3],
];

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function group(doc: DesignSystemDoc, name: string): Json {
  const value = (doc.tokens as Json)[name];
  return isObject(value) ? value : {};
}

// ── colours and contrast ───────────────────────────────────────────────────

export function normalizeHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((raw ?? "").trim());
  if (!m) return null;
  const body = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${body.toLowerCase()}`;
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex) ?? "#000000";
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

export type ColorEntry = { name: string; value: string; description: string };

export function colorEntries(doc: DesignSystemDoc): ColorEntry[] {
  const out: ColorEntry[] = [];
  for (const [name, token] of Object.entries(group(doc, "color"))) {
    if (name.startsWith("$") || !isObject(token)) continue;
    const value = typeof token.$value === "string" ? normalizeHex(token.$value) : null;
    if (value) out.push({ name, value, description: typeof token.$description === "string" ? token.$description : "" });
  }
  return out;
}

export function colorMap(doc: DesignSystemDoc): Record<string, string> {
  return Object.fromEntries(colorEntries(doc).map((entry) => [entry.name, entry.value]));
}

export type ContrastRow = { fg: string; bg: string; ratio: number; level: WcagLevel; required: number; pass: boolean };

export function contrastRows(doc: DesignSystemDoc): ContrastRow[] {
  const colors = colorMap(doc);
  return CONTRAST_PAIRS.filter(([fg, bg]) => colors[fg] && colors[bg]).map(([fg, bg, required]) => {
    const ratio = contrastRatio(colors[fg], colors[bg]);
    return { fg, bg, ratio: Math.round(ratio * 100) / 100, level: wcagLevel(ratio), required, pass: ratio >= required };
  });
}

export function setColor(doc: DesignSystemDoc, name: string, hex: string): DesignSystemDoc {
  const value = normalizeHex(hex);
  if (!value || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) return doc;
  const next = clone(doc);
  const colors = isObject((next.tokens as Json).color) ? ((next.tokens as Json).color as Json) : { $type: "color" };
  const current = isObject(colors[name]) ? (colors[name] as Json) : {};
  colors[name] = { ...current, $value: value };
  (next.tokens as Json).color = colors;
  return next;
}

export function removeColor(doc: DesignSystemDoc, name: string): DesignSystemDoc {
  if ((["bg", "fg", "accent"] as string[]).includes(name)) return doc;
  const next = clone(doc);
  const colors = (next.tokens as Json).color;
  if (isObject(colors)) delete colors[name];
  return next;
}

// ── fonts and type scale ───────────────────────────────────────────────────

export { GOOGLE_FONTS, SELF_HOSTED_FONTS, type FontCategory };

const STACKS: Record<FontCategory, string[]> = {
  sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  serif: ["Georgia", "Times New Roman", "serif"],
  display: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
};

export type FontRole = "display" | "body" | "mono";

export function fontFamily(doc: DesignSystemDoc, role: FontRole): string {
  const value = (group(doc, "font")[role] as Json | undefined)?.$value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value.split(",")[0].replace(/["']/g, "").trim();
  return role === "mono" ? "JetBrains Mono" : "Inter";
}

export function setFont(doc: DesignSystemDoc, role: FontRole, family: string): DesignSystemDoc {
  const known = GOOGLE_FONTS[family] ?? SELF_HOSTED_FONTS[family];
  if (!known) return doc;
  const next = clone(doc);
  const fonts = isObject((next.tokens as Json).font) ? ((next.tokens as Json).font as Json) : { $type: "fontFamily" };
  const current = isObject(fonts[role]) ? (fonts[role] as Json) : {};
  fonts[role] = { ...current, $value: [family, ...STACKS[known[0]]] };
  (next.tokens as Json).font = fonts;
  return next;
}

export { googleFontsHref } from "@/components/deck-player/fonts";

export const TYPE_STEPS: readonly [string, number][] = [
  ["xs", -2],
  ["sm", -1],
  ["base", 0],
  ["lg", 1],
  ["xl", 2],
  ["2xl", 3],
  ["3xl", 4],
  ["4xl", 5],
  ["5xl", 6],
];
const FLOORS: Record<string, number> = { xs: 12, sm: 13 };

export function typeScale(doc: DesignSystemDoc): { base: number; ratio: number } {
  const base = group(doc, "text").base as Json | undefined;
  const hint = (base?.$extensions as Json | undefined)?.forge as Json | undefined;
  const value = isObject(base?.$value) ? (base.$value as Json).value : undefined;
  return {
    base: typeof hint?.base === "number" ? hint.base : typeof value === "number" ? value : 16,
    ratio: typeof hint?.ratio === "number" ? hint.ratio : 1.25,
  };
}

export function scaleSizes(base: number, ratio: number): Record<string, number> {
  return Object.fromEntries(
    TYPE_STEPS.map(([name, step]) => [name, Math.max(FLOORS[name] ?? 0, Math.round(base * ratio ** step))]),
  );
}

export function setTypeScale(doc: DesignSystemDoc, base: number, ratio: number): DesignSystemDoc {
  const next = clone(doc);
  const sizes = scaleSizes(base, ratio);
  const text: Json = { $type: "dimension" };
  for (const [name, px] of Object.entries(sizes)) text[name] = { $value: { value: px, unit: "px" } };
  (text.base as Json).$extensions = { forge: { base, ratio } };
  (next.tokens as Json).text = text;
  return next;
}

// ── dimensions (spacing, radius) ───────────────────────────────────────────

export function dimensionEntries(doc: DesignSystemDoc, name: string): { key: string; px: number }[] {
  const out: { key: string; px: number }[] = [];
  for (const [key, token] of Object.entries(group(doc, name))) {
    if (key.startsWith("$") || !isObject(token)) continue;
    const value = token.$value;
    if (isObject(value) && typeof value.value === "number") out.push({ key, px: value.value });
    else if (typeof value === "number") out.push({ key, px: value });
  }
  return out;
}

export function setDimension(doc: DesignSystemDoc, name: string, key: string, px: number): DesignSystemDoc {
  if (!Number.isFinite(px) || px < 0 || px > 10000) return doc;
  const next = clone(doc);
  const target = isObject((next.tokens as Json)[name]) ? ((next.tokens as Json)[name] as Json) : { $type: "dimension" };
  const current = isObject(target[key]) ? (target[key] as Json) : {};
  target[key] = { ...current, $value: { value: Math.round(px * 100) / 100, unit: "px" } };
  (next.tokens as Json)[name] = target;
  return next;
}

// ── written guidance ───────────────────────────────────────────────────────

export type Guidance = { summary: string; do: string[]; dont: string[] };
export type GuidanceKey = "voice" | "imagery" | "guidelines";

function cleanLines(lines: string[]): string[] {
  return lines.map((line) => line.trim().slice(0, 400)).filter(Boolean).slice(0, 40);
}

export function guidance(doc: DesignSystemDoc, key: GuidanceKey): Guidance {
  const raw = doc[key];
  return { summary: raw?.summary ?? "", do: raw?.do ?? [], dont: raw?.dont ?? [] };
}

export function setGuidance(doc: DesignSystemDoc, key: GuidanceKey, value: Guidance): DesignSystemDoc {
  const next = clone(doc);
  const out: Guidance = { summary: value.summary.slice(0, 2000), do: cleanLines(value.do), dont: cleanLines(value.dont) };
  const block: { summary?: string; do?: string[]; dont?: string[] } = {};
  if (out.summary.trim()) block.summary = out.summary;
  if (out.do.length) block.do = out.do;
  if (out.dont.length) block.dont = out.dont;
  if (Object.keys(block).length) next[key] = block;
  else delete next[key];
  return next;
}

export function iconGuidance(doc: DesignSystemDoc): Guidance & { library: string; style: string; stroke: number } {
  const icon = group(doc, "icon");
  const style = icon.style as Json | undefined;
  const g = ((style?.$extensions as Json | undefined)?.forge as Json | undefined)?.guidance as Json | undefined;
  const stroke = (icon.stroke as Json | undefined)?.$value;
  return {
    library: typeof (icon.library as Json | undefined)?.$value === "string" ? String((icon.library as Json).$value) : "lucide",
    style: typeof style?.$value === "string" ? style.$value : "outline",
    stroke: isObject(stroke) && typeof stroke.value === "number" ? stroke.value : 1.75,
    summary: typeof g?.summary === "string" ? g.summary : "",
    do: Array.isArray(g?.do) ? (g.do as string[]) : [],
    dont: Array.isArray(g?.dont) ? (g.dont as string[]) : [],
  };
}

export function setIconGuidance(
  doc: DesignSystemDoc,
  value: Guidance & { library: string; style: string; stroke: number },
): DesignSystemDoc {
  const next = clone(doc);
  const icon = isObject((next.tokens as Json).icon) ? ((next.tokens as Json).icon as Json) : {};
  icon.library = { ...(isObject(icon.library) ? icon.library : {}), $value: value.library.trim() || "lucide" };
  icon.style = {
    $value: value.style,
    $extensions: {
      forge: { guidance: { summary: value.summary.slice(0, 2000), do: cleanLines(value.do), dont: cleanLines(value.dont) } },
    },
  };
  icon.stroke = { $type: "dimension", $value: { value: value.stroke, unit: "px" } };
  if (!isObject(icon.size)) {
    icon.size = {
      $type: "dimension",
      sm: { $value: { value: 16, unit: "px" } },
      md: { $value: { value: 20, unit: "px" } },
      lg: { $value: { value: 24, unit: "px" } },
    };
  }
  (next.tokens as Json).icon = icon;
  return next;
}

// ── logo rules ─────────────────────────────────────────────────────────────

export function logoRules(doc: DesignSystemDoc): { usage: string[]; misuse: string[] } {
  const usage = doc.logo?.usage ?? [];
  return {
    usage: usage.filter((line) => !line.startsWith(MISUSE_PREFIX)),
    misuse: usage.filter((line) => line.startsWith(MISUSE_PREFIX)).map((line) => line.slice(MISUSE_PREFIX.length)),
  };
}

export function setLogo(
  doc: DesignSystemDoc,
  patch: { usage?: string[]; misuse?: string[]; clearSpace?: string; minSizePx?: number },
): DesignSystemDoc {
  if (!doc.logo) return doc;
  const next = clone(doc);
  const logo = next.logo!;
  const current = logoRules(doc);
  const usage = cleanLines(patch.usage ?? current.usage);
  const misuse = cleanLines(patch.misuse ?? current.misuse).map((line) => MISUSE_PREFIX + line);
  const lines = [...usage, ...misuse].slice(0, 40);
  if (lines.length) logo.usage = lines;
  else delete logo.usage;
  if (patch.clearSpace !== undefined) {
    if (patch.clearSpace.trim()) logo.clearSpace = patch.clearSpace.slice(0, 200);
    else delete logo.clearSpace;
  }
  if (patch.minSizePx !== undefined && patch.minSizePx >= 8 && patch.minSizePx <= 2000) logo.minSizePx = Math.round(patch.minSizePx);
  return next;
}

// ── CSS ────────────────────────────────────────────────────────────────────

/** Every token as a CSS custom property, `--font-sans` added like the API. */
export function cssVars(doc: DesignSystemDoc): Record<string, string> {
  const vars: Record<string, string> = tokensFromDesignSystem(doc.tokens);
  if (vars["--font-body"] && !vars["--font-sans"]) vars["--font-sans"] = vars["--font-body"];
  return vars;
}
