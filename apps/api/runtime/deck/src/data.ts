/**
 * Where the published player and the exports find their deck.
 *
 * Two layouts, one bundle:
 * - published site: `deck.json`, `slides/<id>.json`, `theme.json`, and
 *   `notes.json` when the owner shares notes, fetched next to the page;
 * - single-file HTML export: everything inline in
 *   `<script type="application/json" id="forge-deck-data">`, images as data URIs.
 *
 * The page's options always come from `#forge-deck-config`.
 */

import type { Deck, Slide } from "@forge/deck-player/types";

export type PageMode = "present" | "presenter" | "print";

export type DeckConfig = {
  mode: PageMode;
  /** "Made with Forge" badge on the audience view. */
  badge?: boolean;
  /** Load notes.json (published site only; inline data carries its own). */
  notes?: boolean;
  /** Print: one page per animation step instead of one per slide. */
  steps?: boolean;
  /** Folder of the data files relative to the page ("./" or "../"). */
  base?: string;
  /** Presenter page relative to the base ("presenter/"); none = popup. */
  presenter?: string | null;
  locale?: "fr" | "en";
  /** Load theme fonts from Google Fonts (default true). */
  webFonts?: boolean;
};

export type DeckData = {
  deck: Deck;
  slides: Record<string, Slide>;
  notes?: Record<string, string>;
  /** DESIGN.md (or design-system.json) text of the theme. */
  design: string;
  /** Inline assets, path to data URI (single-file export). */
  assets?: Record<string, string>;
};

const SAFE_ASSET = /^(?!.*\.\.)(?!\/)[A-Za-z0-9_./-]+$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function readJsonScript<T>(id: string): T | null {
  const el = document.getElementById(id);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return null;
  }
}

export function readConfig(): DeckConfig {
  const config = readJsonScript<Partial<DeckConfig>>("forge-deck-config") ?? {};
  const mode: PageMode = config.mode === "print" || config.mode === "presenter" ? config.mode : "present";
  return { ...config, mode };
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url.href, { credentials: "omit" });
  if (!res.ok) throw new Error(`${url.pathname}: ${res.status}`);
  return (await res.json()) as T;
}

export function baseUrl(config: DeckConfig): URL {
  return new URL(config.base ?? "./", document.baseURI);
}

export async function loadData(config: DeckConfig): Promise<DeckData> {
  const inline = readJsonScript<DeckData>("forge-deck-data");
  if (inline) return inline;
  const base = baseUrl(config);
  const deck = await getJson<Deck>(new URL("deck.json", base));
  const ids = deck.slides.map((ref) => ref.id).filter((id) => SAFE_ID.test(id));
  const [slides, theme, notes] = await Promise.all([
    Promise.all(ids.map((id) => getJson<Slide>(new URL(`slides/${id}.json`, base)).catch(() => ({ id, elements: [] }) as Slide))),
    getJson<{ design?: string }>(new URL("theme.json", base)).catch(() => ({ design: "" })),
    config.notes ? getJson<Record<string, string>>(new URL("notes.json", base)).catch(() => ({})) : Promise.resolve(undefined),
  ]);
  return {
    deck,
    slides: Object.fromEntries(slides.map((s) => [s.id, s])),
    notes,
    design: theme.design ?? "",
  };
}

/** Asset path ("public/images/x.webp") to a URL: inline data first, then next to the data files. */
export function assetResolver(data: DeckData, config: DeckConfig): (path: string) => string {
  const base = baseUrl(config);
  return (path: string) => {
    const inline = data.assets?.[path];
    if (inline) return inline;
    if (!SAFE_ASSET.test(path)) return "";
    return new URL(path, base).href;
  };
}
