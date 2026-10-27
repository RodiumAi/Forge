/**
 * Web fonts of a deck theme. The theme names font stacks ("Inter, sans-serif");
 * the first family of each role is loaded from Google Fonts unless it is a
 * system or generic family. Offline (single-file export) the request simply
 * fails and the stack's fallbacks apply.
 */

export type ThemeTokens = Record<string, string>;

const FONT_ROLES = ["--font-display", "--font-body", "--font-mono"];

/** Families every system has, or that Google Fonts does not serve. */
const LOCAL_FAMILIES = new Set(
  [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "ui-rounded",
    "-apple-system",
    "blinkmacsystemfont",
    "arial",
    "helvetica",
    "helvetica neue",
    "georgia",
    "times",
    "times new roman",
    "verdana",
    "tahoma",
    "trebuchet ms",
    "courier",
    "courier new",
    "segoe ui",
    "calibri",
    "cambria",
    "consolas",
    "menlo",
    "monaco",
    "sf mono",
    "sf pro",
    "sf pro display",
    "sf pro text",
    "aptos",
  ].map((f) => f.toLowerCase()),
);

/** First family of a CSS font stack, unquoted ("\"DM Sans\", sans-serif" to "DM Sans"). */
export function firstFamily(stack: string | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "").trim();
  if (!first || first.startsWith("var(")) return null;
  return first;
}

/** Google Fonts families a theme needs, in role order, without duplicates. */
export function googleFamilies(tokens: ThemeTokens): string[] {
  const out: string[] = [];
  for (const role of FONT_ROLES) {
    const family = firstFamily(tokens[role]);
    if (!family || LOCAL_FAMILIES.has(family.toLowerCase())) continue;
    if (!/^[A-Za-z0-9 ]{1,60}$/.test(family)) continue;
    if (!out.includes(family)) out.push(family);
  }
  return out;
}

/**
 * One css2 URL per family (regular and bold). Separate links on purpose: css2
 * fails the whole request when one family lacks a requested weight.
 */
export function googleFontsHrefs(tokens: ThemeTokens): string[] {
  return googleFamilies(tokens).map(
    (f) => `https://fonts.googleapis.com/css2?family=${f.trim().replace(/ +/g, "+")}:wght@400;700&display=swap`,
  );
}
