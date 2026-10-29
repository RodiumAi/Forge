/**
 * Importing the slides of a PowerPoint file into the deck.
 *
 * The server converts the .pptx into Forge slides (pictures are stored in the
 * project) without touching the deck; the editor shows them, the user picks
 * some, and `importSlides` inserts the picks through a normal document edit,
 * so undo and autosave work as for any other change. Unchecking "keep the
 * original theme" runs `toDeckTheme`, which swaps the literal colours of the
 * file for the deck theme tokens.
 */

import { apiBase, ApiError, getToken, readApiError } from "@/lib/api";
import { slideSchema, type Slide, type SlideElement } from "@/lib/contracts/forge-design";
import { freshId, insertSlide, type Doc, type SlideRef } from "./model";
import type { DeckStringKey } from "./strings";

/** Largest file the server converts (its request body limit is 16 MB). */
export const MAX_SLIDE_IMPORT_BYTES = 15 * 1024 * 1024;
export const PPTX_ACCEPT = ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type ImportedSlide = {
  /** Position in the file, from 1. */
  index: number;
  title: string;
  hidden: boolean;
  slide: Slide;
  notes: string;
  warnings: Record<string, number>;
};

export type SlideImport = {
  canvas: { width: number; height: number };
  slides: ImportedSlide[];
  warnings: Record<string, number>;
};

export type SlideImportClient = {
  importPptx(file: File): Promise<SlideImport>;
};

export function isPptxFile(file: Pick<File, "name" | "type">): boolean {
  return file.name.toLowerCase().endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}

export function apiSlideImportClient(projectId: string): SlideImportClient {
  return {
    importPptx: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/slides/import/pptx`, { method: "POST", headers, body: form });
      if (!res.ok) throw await readApiError(res);
      return (await res.json()) as SlideImport;
    },
  };
}

/** The message shown for a failed import. */
export function importErrorKey(error: unknown): DeckStringKey {
  if (!(error instanceof ApiError)) return "importErrorGeneric";
  if (error.code === "PPTX_TOO_LARGE" || error.status === 413) return "importErrorSize";
  if (error.code === "PPTX_ENCRYPTED") return "importErrorEncrypted";
  if (error.code === "PPTX_TOO_COMPLEX") return "importErrorComplex";
  if (error.code === "PPTX_INVALID") return "importErrorInvalid";
  if (error.status === 429) return "importErrorRate";
  return "importErrorGeneric";
}

// ── selection ───────────────────────────────────────────────────────────────

/** Every slide of the file, by its `index`. */
export function selectAll(slides: readonly ImportedSlide[]): Set<number> {
  return new Set(slides.map((s) => s.index));
}

export function toggleSlide(selection: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(selection);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

/** The picked slides, in the order of the file (not the order of the clicks). */
export function pickedSlides(slides: readonly ImportedSlide[], selection: ReadonlySet<number>): ImportedSlide[] {
  return slides.filter((s) => selection.has(s.index));
}

/** Warning codes of the picked slides, added up. */
export function warningTotals(slides: readonly ImportedSlide[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const s of slides) {
    for (const [code, n] of Object.entries(s.warnings)) totals.set(code, (totals.get(code) ?? 0) + n);
  }
  return [...totals.entries()].filter(([, n]) => n > 0);
}

/** Where imported slides go: right after the current slide, at the end otherwise. */
export function insertionIndex(doc: Doc, currentId: string | null): number {
  const at = currentId ? doc.deck.slides.findIndex((ref) => ref.id === currentId) : -1;
  return at >= 0 ? at + 1 : doc.deck.slides.length;
}

// ── insertion ───────────────────────────────────────────────────────────────

export type ImportResult = {
  doc: Doc;
  /** Ids of the new slides, in deck order. */
  ids: string[];
  /** Speaker notes to set, by new slide id. */
  notes: Record<string, string>;
};

/**
 * Insert the picks at `index`, in order, each under a fresh slide id. Slides
 * that do not pass the contract (they should, the server checks them) are
 * skipped rather than written.
 */
export function importSlides(doc: Doc, picks: readonly ImportedSlide[], index: number, options: { keepTheme: boolean; random?: () => number }): ImportResult {
  const taken = new Set([...doc.deck.slides.map((ref) => ref.id), ...Object.keys(doc.slides)]);
  let next = doc;
  let at = Math.max(0, Math.min(index, doc.deck.slides.length));
  const ids: string[] = [];
  const notes: Record<string, string> = {};
  for (const pick of picks) {
    const id = freshId("s", taken, options.random);
    const source = options.keepTheme ? pick.slide : toDeckTheme(pick.slide);
    const parsed = slideSchema.safeParse({ ...structuredClone(source), id });
    if (!parsed.success) continue;
    const ref: SlideRef = pick.hidden ? { id, layout: "text", hidden: true } : { id, layout: "text" };
    next = insertSlide(next, ref, parsed.data, at);
    at += 1;
    ids.push(id);
    const text = pick.notes.trim();
    if (text) notes[id] = text.slice(0, 20000);
  }
  return { doc: next, ids, notes };
}

// ── deck theme mapping ──────────────────────────────────────────────────────

type Rgba = { r: number; g: number; b: number; a: number };

export function parseHex(value: string): Rgba | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!m) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) : 1 };
}

/** Relative luminance (WCAG). */
function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A colour, not a grey: saturated and neither near black nor near white. */
function isChromatic({ r, g, b }: Rgba): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (max === min || light < 0.1 || light > 0.94) return false;
  const sat = (max - min) / (1 - Math.abs(2 * light - 1));
  return sat > 0.3;
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

type Surface = { color: Rgba; token: string };

function backgroundOf(slide: Slide): Rgba {
  const bg = slide.background;
  const hex = bg?.type === "color" ? bg.token : bg?.type === "gradient" ? bg.stops[0]?.color : undefined;
  return (hex && parseHex(hex)) || WHITE;
}

function textToken(color: Rgba, under: Surface): string {
  if (under.token === "--accent" || under.token === "--fg") {
    // Text on a strong block: the page colour reads on it.
    return contrast(color, under.color) >= 3 ? "--bg" : "--fg";
  }
  if (isChromatic(color)) return "--accent";
  return contrast(color, under.color) >= 3.5 ? "--fg" : "--muted";
}

function fillToken(color: Rgba, page: Rgba): string {
  if (isChromatic(color)) return "--accent";
  const ratio = contrast(color, page);
  if (ratio < 1.03) return "--bg";
  if (ratio < 3) return "--surface";
  return "--fg";
}

function strokeToken(color: Rgba, page: Rgba): string {
  if (isChromatic(color)) return "--accent";
  return contrast(color, page) >= 3.5 ? "--fg" : "--border";
}

function mapColor(value: string | undefined, fn: (c: Rgba) => string): string | undefined {
  if (value === undefined) return undefined;
  const color = parseHex(value);
  return color ? fn(color) : value;
}

function contains(outer: SlideElement, inner: SlideElement): boolean {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h;
}

function mapRuns<T extends { color?: string }>(runs: T[] | undefined, base: string | undefined, fn: (c: Rgba) => string): T[] | undefined {
  if (!runs) return runs;
  return runs.map((run) => {
    if (run.color === undefined) return run;
    const token = mapColor(run.color, fn);
    const { color: _drop, ...rest } = run;
    return token === base ? (rest as T) : { ...run, color: token };
  });
}

/**
 * The same slide with its literal colours replaced by deck theme tokens:
 * backgrounds become `--bg`, colourful marks `--accent`, neutral text `--fg`
 * or `--muted`, neutral blocks `--surface` or `--fg`, lines `--border`.
 * Fonts are already theme roles (display, body, mono) and stay as they are.
 */
export function toDeckTheme(slide: Slide): Slide {
  const page = backgroundOf(slide);
  const pageSurface: Surface = { color: page, token: "--bg" };

  const mapElements = (elements: SlideElement[], parentSurface: Surface): SlideElement[] => {
    const out: SlideElement[] = [];
    // Elements are painted in order; the last opaque block under a text is its surface.
    const blocks: { el: SlideElement; surface: Surface }[] = [];
    const ordered = [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    const surfaces = new Map<SlideElement, Surface>();
    for (const el of ordered) {
      let under = parentSurface;
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (contains(blocks[i].el, el)) {
          under = blocks[i].surface;
          break;
        }
      }
      surfaces.set(el, under);
      if (el.type === "shape" && (el.shape === "rect" || el.shape === "ellipse") && el.fill) {
        const color = parseHex(el.fill);
        if (color && color.a > 0.5) blocks.push({ el, surface: { color, token: fillToken(color, page) } });
      }
    }
    for (const el of elements) out.push(mapElement(el, surfaces.get(el) ?? parentSurface));
    return out;
  };

  const mapElement = (el: SlideElement, under: Surface): SlideElement => {
    const text = (c: Rgba) => textToken(c, under);
    switch (el.type) {
      case "text": {
        const base = mapColor(el.style?.color, text);
        const style = el.style ? { ...el.style, ...(base ? { color: base } : {}) } : el.style;
        const content = el.content.map((block) =>
          block.type === "paragraph"
            ? { ...block, runs: mapRuns(block.runs, base, text) }
            : { ...block, items: block.items.map((item) => ({ ...item, runs: mapRuns(item.runs, base, text) })) },
        );
        return clean({ ...el, style, content });
      }
      case "shape": {
        const line = el.shape === "line" || el.shape === "arrow";
        const fill = el.fill && parseHex(el.fill)?.a === 0 ? el.fill : mapColor(el.fill, (c) => fillToken(c, page));
        const stroke = mapColor(el.stroke, (c) => (line && !isChromatic(c) && contrast(c, page) >= 1.5 ? "--fg" : strokeToken(c, page)));
        return clean({ ...el, fill, stroke });
      }
      case "icon":
        return clean({ ...el, color: mapColor(el.color, text) });
      case "table": {
        if (!el.style) return el;
        const color = mapColor(el.style.color, text);
        const style = clean({
          ...el.style,
          color,
          headerFill: el.style.headerFill === undefined ? undefined : "--surface",
          border: el.style.border === undefined ? undefined : "--border",
        });
        const rows = el.rows.map((row) => row.map((cell) => ({ ...cell, runs: mapRuns(cell.runs, color, text) })).map(clean));
        return { ...el, style, rows };
      }
      case "chart":
        return { ...el, data: { ...el.data, series: el.data.series.map(({ color: _drop, ...series }) => series) } };
      case "group":
        return { ...el, children: mapElements(el.children, under) };
      default:
        return el;
    }
  };

  const background = slide.background?.type === "image" ? clean({ ...slide.background, overlay: slide.background.overlay === undefined ? undefined : "--bg" }) : { type: "color" as const, token: "--bg" };
  return { ...slide, background, elements: mapElements(slide.elements, pageSurface) };
}

/** Drop keys left `undefined` (the contract has no optional nulls). */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
