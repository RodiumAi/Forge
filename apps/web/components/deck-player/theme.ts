/**
 * Theme tokens: DESIGN.md or design-system.json to CSS custom properties, and
 * resolution of the token references used inside slides.
 *
 * Mapping rule (contracts/forge-design/design-system.schema.json): a token at
 * `color.<name>` becomes `--<name>`, a token in any other group becomes
 * `--<group>-<name>`. Nested groups join their path with "-", so
 * `color.brand.primary` is `--brand-primary` and `font.display` is
 * `--font-display`.
 */

import type { ThemeTokens } from "./types";

/** Used when a deck has no charter at all, so a slide always renders legibly. */
export const DEFAULT_TOKENS: ThemeTokens = {
  "--bg": "#0B0D12",
  "--fg": "#F5F7FA",
  "--muted": "#8B93A7",
  "--accent": "#F2620A",
  "--surface": "#151922",
  "--border": "#2A3140",
  "--font-display": "Inter, system-ui, sans-serif",
  "--font-body": "Inter, system-ui, sans-serif",
  "--font-mono": "\"JetBrains Mono\", ui-monospace, monospace",
};

const FONT_FALLBACK: Record<string, string> = {
  display: "system-ui, sans-serif",
  body: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
};

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoteFamily(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (/^["'].*["']$/.test(trimmed)) return trimmed;
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/;
  return /\s/.test(trimmed) && !generic.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function cssVarName(path: string[]): string {
  const [group, ...rest] = path;
  if (group === "color" && rest.length > 0) return `--${rest.join("-")}`;
  return `--${path.join("-")}`;
}

/** W3C alias "{color.bg}" to var(--bg). */
function aliasToVar(value: string): string {
  return value.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, ref: string) => `var(${cssVarName(ref.split("."))})`);
}

function dimension(value: Json): string | null {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return aliasToVar(value);
  if (isObject(value) && typeof value.value === "number") return `${value.value}${typeof value.unit === "string" ? value.unit : "px"}`;
  return null;
}

function shadowValue(value: Json): string | null {
  const one = (v: Json): string | null => {
    if (!isObject(v)) return typeof v === "string" ? aliasToVar(v) : null;
    const parts = [v.offsetX, v.offsetY, v.blur, v.spread].map((p) => dimension(p ?? 0) ?? "0px");
    const color = typeof v.color === "string" ? aliasToVar(v.color) : "transparent";
    return `${v.inset ? "inset " : ""}${parts.join(" ")} ${color}`;
  };
  if (Array.isArray(value)) {
    const all = value.map(one).filter((s): s is string => !!s);
    return all.length ? all.join(", ") : null;
  }
  return one(value);
}

/** One W3C token value to a CSS string; null when it has no CSS meaning. */
export function tokenValueToCss(value: Json, type?: string): string | null {
  if (type === "fontFamily" || (Array.isArray(value) && value.every((v) => typeof v === "string") && type !== "cubicBezier")) {
    const list = Array.isArray(value) ? (value as string[]) : [String(value)];
    return list.map(quoteFamily).filter(Boolean).join(", ") || null;
  }
  if (type === "cubicBezier" && Array.isArray(value) && value.length === 4) return `cubic-bezier(${value.join(", ")})`;
  if (type === "shadow") return shadowValue(value);
  if (type === "duration" && isObject(value) && typeof value.value === "number") {
    return `${value.value}${value.unit === "s" ? "s" : "ms"}`;
  }
  if (typeof value === "number") return type === "dimension" ? `${value}px` : String(value);
  if (typeof value === "string") return aliasToVar(value);
  if (isObject(value)) {
    if (typeof value.value === "number") return dimension(value);
    if (type === "border" && value.width !== undefined) {
      return `${dimension(value.width) ?? "1px"} ${typeof value.style === "string" ? value.style : "solid"} ${typeof value.color === "string" ? aliasToVar(value.color) : "currentColor"}`;
    }
  }
  return null;
}

/** Walks a W3C token tree; `$type` is inherited from the nearest group. */
export function tokensFromDesignSystem(tree: Json): ThemeTokens {
  const out: ThemeTokens = {};
  const walk = (node: Json, path: string[], inheritedType?: string) => {
    if (!isObject(node)) return;
    const type = typeof node.$type === "string" ? node.$type : inheritedType;
    if ("$value" in node) {
      const css = tokenValueToCss(node.$value, type);
      if (css !== null && path.length > 0) out[cssVarName(path)] = css;
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      walk(child, [...path, key], type);
    }
  };
  walk(tree, []);
  return out;
}

// Accepts "--bg: #fff" and the charter form "- `--bg`: #0D1B2A (slide background)".
const VAR_LINE_RE = /`?(--[A-Za-z0-9-]{1,48})`?\s*:\s*([^;\n]+)/g;
const TRAILING_ROLE_RE = /\s+\([^()]*\)\s*$/;

/** Font stacks named in a DESIGN.md: "Display font: X", "Font stack: X", "Mono: X". */
function fontsFromMarkdown(md: string): ThemeTokens {
  const out: ThemeTokens = {};
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/^\s*[-*]\s*/, "");
    const match = /^([A-Za-z ]{0,40}?)\b(font|fonts|typeface|font stack)\b\s*([A-Za-z ]{0,20}):\s*(.+)$/i.exec(line);
    if (!match) continue;
    const label = `${match[1]} ${match[3]}`.toLowerCase();
    const stack = match[4].split(/\(|\.\s/)[0].replace(/\s*\(.*$/, "").trim().replace(/[.;]$/, "");
    if (!stack || stack.length > 300) continue;
    const role = /mono|code/.test(label) ? "mono" : /display|head|title/.test(label) ? "display" : "body";
    // Quote multi-word families: "Source Serif 4" unquoted is invalid CSS.
    if (!out[`--font-${role}`]) out[`--font-${role}`] = stack.split(",").map(quoteFamily).filter(Boolean).join(", ");
  }
  if (out["--font-body"] && !out["--font-display"]) out["--font-display"] = out["--font-body"];
  if (out["--font-display"] && !out["--font-body"]) out["--font-body"] = out["--font-display"];
  return out;
}

/**
 * DESIGN.md (markdown with `--name: value` lines) or the text of a
 * design-system.json to theme tokens. Unknown or empty input yields the
 * defaults, so the player never renders without colors.
 */
export function themeTokensFromDesign(md: string): ThemeTokens {
  const source = (md ?? "").trim();
  let found: ThemeTokens = {};
  if (source.startsWith("{")) {
    try {
      const parsed: Json = JSON.parse(source);
      if (isObject(parsed)) found = tokensFromDesignSystem(isObject(parsed.tokens) ? parsed.tokens : parsed);
    } catch {
      found = {};
    }
  } else if (source) {
    found = fontsFromMarkdown(source);
    for (const match of source.matchAll(VAR_LINE_RE)) {
      const name = match[1];
      const value = match[2].trim().replace(TRAILING_ROLE_RE, "").replace(/^`+|[`,]+$/g, "").trim();
      if (value && !(name in found)) found[name] = value;
    }
  }
  return { ...DEFAULT_TOKENS, ...found };
}

/** Slide color reference ("--fg" or "#hex") to a CSS color. */
export function colorRef(ref: string | undefined, fallback = "currentColor"): string {
  if (!ref) return fallback;
  return ref.startsWith("--") ? `var(${ref})` : ref;
}

/** Text font role to a CSS font-family; an explicit `family` comes first, the role's font backs it up. */
export function fontRef(role: string | undefined, family?: string): string {
  const key = role ?? "body";
  const themed = `var(--font-${key}, ${FONT_FALLBACK[key] ?? FONT_FALLBACK.body})`;
  return family ? `${quoteFamily(family)}, ${themed}` : themed;
}

/** Tokens as a React style object (custom properties on the canvas root). */
export function tokensToStyle(tokens: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith("--")) style[key] = value;
  }
  return style;
}
