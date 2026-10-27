/**
 * Layout extraction for the PPTX export (bundled in the "export" variant only).
 *
 * The print page has every slide drawn at canvas size. For each element the
 * document gives the type and its data (chart series, table cells, crop); the
 * DOM, through the player's hooks (`data-print-page`, `data-slide-id`,
 * `data-element-id`, `data-element-type`), gives what the document only
 * references: absolute boxes once groups are resolved, and computed styles
 * with theme tokens resolved to real colors and font families.
 *
 * What PowerPoint cannot draw natively (icons, rounded or cropped images,
 * video placeholders, rotated groups, gradient and image backgrounds) is
 * listed as a raster: `isolate(key)` leaves only that thing visible so the
 * caller can screenshot it with a transparent background.
 */

import { buildSchedule } from "@forge/deck-player";
import type { Deck, Slide, SlideElement } from "@forge/deck-player/types";
import { seriesColor } from "@forge/deck-player/chart";
import type { DeckData } from "./data";

export type Rgba = { hex: string; alpha: number };
export type Box = { x: number; y: number; w: number; h: number; rotate: number; opacity: number };
export type Run = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: Rgba;
  size: number;
  font: string;
  link?: string;
  breakLine?: boolean;
};
export type Para = {
  runs: Run[];
  align: "left" | "center" | "right" | "justify";
  bullet: null | "bullet" | "number";
  level: number;
  /** Line height as a multiple of the font size, and in canvas pixels. */
  lineHeight: number;
  lineHeightPx: number;
};

type Base = { id: string; name?: string; matchKey?: string; box: Box; link?: string };

export type Item =
  | (Base & { kind: "text"; paras: Para[]; valign: "top" | "middle" | "bottom" })
  | (Base & {
      kind: "image";
      src: string;
      fit: "cover" | "contain" | "fill";
      crop?: { x: number; y: number; w: number; h: number };
      alt?: string;
    })
  | (Base & { kind: "shape"; shape: "rect" | "ellipse" | "line" | "arrow"; fill: Rgba | null; line: { color: Rgba; width: number } | null; radius: number })
  | (Base & {
      kind: "table";
      rows: { runs: Run[]; header: boolean }[][];
      colWidths: number[];
      headerFill: Rgba | null;
      border: Rgba;
      fontSize: number;
    })
  | (Base & {
      kind: "chart";
      chart: "bar" | "line" | "pie";
      labels: string[];
      series: { name: string; values: number[]; color: Rgba }[];
      sliceColors: Rgba[];
      stacked: boolean;
      legend: boolean;
      values: boolean;
      text: Rgba;
      muted: Rgba;
      font: string;
      fontSize: number;
    })
  | (Base & { kind: "code"; lines: Run[][]; background: Rgba; highlight: { y: number; h: number }[]; highlightFill: Rgba; lineHeightPx: number; paddingTop: number; fontSize: number; font: string })
  | (Base & { kind: "raster"; key: string; reason: string });

export type SlideLayout = {
  page: number;
  slideId: string;
  step: number | null;
  background: { type: "color"; color: Rgba } | { type: "raster"; key: string };
  items: Item[];
};

export type RasterRef = { key: string; page: number; elementId: string | null };

export type Layout = {
  width: number;
  height: number;
  title: string | null;
  slides: SlideLayout[];
  rasters: RasterRef[];
  fonts: string[];
};

// ── colors ──────────────────────────────────────────────────────────────────

let probeCanvas: CanvasRenderingContext2D | null = null;

/** Any CSS color the browser understands to sRGB hex + alpha (via a 1px canvas). */
export function cssColorToRgba(css: string | null | undefined): Rgba | null {
  if (!css || css === "none" || css === "transparent") return null;
  if (!probeCanvas) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    probeCanvas = canvas.getContext("2d", { willReadFrequently: true });
  }
  const ctx = probeCanvas;
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#010203";
  ctx.fillStyle = css;
  if (ctx.fillStyle === "#010203" && css.replace(/\s/g, "").toLowerCase() !== "#010203") return null;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  const hex = [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { hex, alpha: Math.round((a / 255) * 1000) / 1000 };
}

/** A CSS color expression (may use theme variables) resolved inside `scope`. */
function resolveIn(scope: Element, css: string, fallback = "#000000"): Rgba {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  scope.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return cssColorToRgba(computed) ?? cssColorToRgba(fallback) ?? { hex: "000000", alpha: 1 };
}

function colorRefCss(ref: string | undefined, fallback: string): string {
  if (!ref) return fallback;
  return ref.startsWith("--") ? `var(${ref}, ${fallback})` : ref;
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

export function firstFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Box of an element relative to its slide canvas, transforms ignored. */
function offsetBox(el: HTMLElement, canvas: HTMLElement): { x: number; y: number; w: number; h: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  // Each offsetLeft is relative to the node's offsetParent: sum up to the canvas.
  while (node && node !== canvas) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function runFrom(node: Node, text: string, link?: string): Run | null {
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el || !text) return null;
  const cs = getComputedStyle(el);
  const deco = cs.textDecorationLine || cs.textDecoration || "";
  const transform = cs.textTransform;
  const shown = transform === "uppercase" ? text.toUpperCase() : transform === "lowercase" ? text.toLowerCase() : text;
  return {
    text: shown,
    bold: Number(cs.fontWeight) >= 600 || cs.fontWeight === "bold",
    italic: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
    underline: deco.includes("underline"),
    strike: deco.includes("line-through"),
    color: cssColorToRgba(cs.color) ?? { hex: "000000", alpha: 1 },
    size: parseFloat(cs.fontSize) || 16,
    font: firstFamily(cs.fontFamily),
    link,
  };
}

/** Runs of a block (p, li, td, code line), one per styled text node. */
function runsOf(block: Element): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, link?: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const run = runFrom(node, node.textContent ?? "", link);
      if (run) runs.push(run);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      if (runs.length) runs[runs.length - 1].breakLine = true;
      return;
    }
    if (node.matches("ul,ol")) return;
    const href = node.tagName === "A" ? node.getAttribute("href") ?? undefined : link;
    node.childNodes.forEach((child) => walk(child, href && /^https:\/\//.test(href) ? href : undefined));
  };
  block.childNodes.forEach((child) => walk(child));
  return runs;
}

function alignOf(cs: CSSStyleDeclaration): Para["align"] {
  const a = cs.textAlign;
  if (a === "center" || a === "right" || a === "justify") return a;
  if (a === "end") return "right";
  return "left";
}

function lineHeightOf(cs: CSSStyleDeclaration): { lineHeight: number; lineHeightPx: number } {
  const size = parseFloat(cs.fontSize) || 16;
  const lh = parseFloat(cs.lineHeight);
  const px = Number.isFinite(lh) && lh > 0 ? lh : size * 1.2;
  return { lineHeight: Math.round((px / size) * 100) / 100, lineHeightPx: Math.round(px * 100) / 100 };
}

function textParas(root: HTMLElement): { paras: Para[]; valign: "top" | "middle" | "bottom" } {
  const container = root.querySelector<HTMLElement>("[data-role], div") ?? root;
  const ccs = getComputedStyle(container);
  const jc = ccs.justifyContent;
  const valign = jc === "center" ? "middle" : jc === "flex-end" || jc === "end" ? "bottom" : "top";
  const paras: Para[] = [];
  for (const block of Array.from(container.children)) {
    if (block.tagName === "P") {
      const cs = getComputedStyle(block);
      paras.push({ runs: runsOf(block), align: alignOf(cs), bullet: null, level: 0, ...lineHeightOf(cs) });
    } else if (block.tagName === "UL" || block.tagName === "OL") {
      for (const li of Array.from(block.children)) {
        const cs = getComputedStyle(li);
        const indent = parseFloat(cs.marginLeft) || 0;
        const em = parseFloat(cs.fontSize) || 16;
        paras.push({
          runs: runsOf(li),
          align: alignOf(cs),
          bullet: block.tagName === "OL" ? "number" : "bullet",
          level: Math.max(0, Math.min(4, Math.round(indent / (1.2 * em)))),
          ...lineHeightOf(cs),
        });
      }
    }
  }
  return { paras, valign };
}

// ── extraction ──────────────────────────────────────────────────────────────

function flattenWithGroups(elements: SlideElement[], out: { el: SlideElement; groupRotated: boolean; opacity: number }[], opacity: number, rotated: boolean) {
  for (const el of elements) {
    if (el.type === "group" && !el.rotation && !rotated) {
      flattenWithGroups(el.children, out, opacity * (el.opacity ?? 1), false);
    } else {
      out.push({ el, groupRotated: rotated, opacity });
    }
  }
}

function extractPage(page: HTMLElement, index: number, data: DeckData, rasters: RasterRef[], fonts: Set<string>): SlideLayout | null {
  const slideId = page.dataset.pageSlide ?? "";
  const stepAttr = page.dataset.pageStep;
  const canvas = page.querySelector<HTMLElement>("[data-slide-id]");
  const slide: Slide | undefined = data.slides[slideId];
  if (!canvas || !slide) return null;

  const bg = slide.background;
  let background: SlideLayout["background"];
  if (bg && bg.type !== "color") {
    const key = `p${index}-bg`;
    rasters.push({ key, page: index, elementId: null });
    background = { type: "raster", key };
  } else {
    background = { type: "color", color: cssColorToRgba(getComputedStyle(canvas).backgroundColor) ?? { hex: "000000", alpha: 1 } };
  }

  const flat: { el: SlideElement; groupRotated: boolean; opacity: number }[] = [];
  flattenWithGroups(slide.elements, flat, 1, false);
  // Paint order: the player sorts siblings by z, then document order.
  const order = new Map<string, number>();
  canvas.querySelectorAll<HTMLElement>("[data-element-id]").forEach((node, i) => order.set(node.dataset.elementId ?? "", i));
  flat.sort((a, b) => (order.get(a.el.id) ?? 0) - (order.get(b.el.id) ?? 0));

  const items: Item[] = [];
  for (const { el, opacity } of flat) {
    const node = canvas.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(el.id)}"]`);
    if (!node) continue; // hidden, or not shown at this step
    const ob = offsetBox(node, canvas);
    const base: Base = {
      id: el.id,
      name: el.name,
      matchKey: (el as { matchKey?: string }).matchKey,
      link: el.link,
      box: { ...ob, rotate: el.rotation ?? 0, opacity: (el.opacity ?? 1) * opacity },
    };
    const raster = (reason: string) => {
      const key = `p${index}-${el.id}`;
      rasters.push({ key, page: index, elementId: el.id });
      items.push({ ...base, kind: "raster", key, reason });
    };
    switch (el.type) {
      case "text": {
        const { paras, valign } = textParas(node);
        paras.forEach((p) => p.runs.forEach((r) => r.font && fonts.add(r.font)));
        items.push({ ...base, kind: "text", paras, valign });
        break;
      }
      case "image": {
        if ((el.radius ?? 0) > 0) raster("rounded image");
        else items.push({ ...base, kind: "image", src: el.src, fit: el.fit ?? "cover", crop: el.crop, alt: el.alt });
        break;
      }
      case "shape": {
        const svgShape = node.querySelector("rect, ellipse, line");
        const cs = svgShape ? getComputedStyle(svgShape) : null;
        const isLine = el.shape === "line" || el.shape === "arrow";
        const strokeWidth = el.strokeWidth ?? (isLine ? 4 : 0);
        const fill = !isLine && cs ? cssColorToRgba(cs.fill) : null;
        const strokeColor = cs ? cssColorToRgba(cs.stroke) : null;
        items.push({
          ...base,
          kind: "shape",
          shape: el.shape,
          fill,
          line: strokeColor && strokeWidth > 0 ? { color: strokeColor, width: strokeWidth } : null,
          radius: Math.min(el.radius ?? 0, el.w / 2, el.h / 2),
        });
        break;
      }
      case "table": {
        const table = node.querySelector("table");
        if (!table) {
          raster("table not drawn");
          break;
        }
        const tcs = getComputedStyle(table);
        const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.children).map((cell) => ({ runs: runsOf(cell), header: cell.tagName === "TH" })),
        );
        rows.forEach((r) => r.forEach((c) => c.runs.forEach((run) => run.font && fonts.add(run.font))));
        const cols = Array.from(table.querySelectorAll("col")).map((col) => (col as HTMLElement).getBoundingClientRect().width);
        const firstCell = table.querySelector("td, th");
        const headerRow = table.querySelector("tr");
        items.push({
          ...base,
          kind: "table",
          rows,
          colWidths: cols.length ? cols : [ob.w],
          headerFill: el.headerRow && headerRow ? cssColorToRgba(getComputedStyle(headerRow).backgroundColor) : null,
          border: (firstCell && cssColorToRgba(getComputedStyle(firstCell).borderTopColor)) ?? { hex: "7F7F7F", alpha: 0.4 },
          fontSize: parseFloat(tcs.fontSize) || 24,
        });
        break;
      }
      case "chart": {
        const scope = node;
        const series = el.data.series.map((s, i) => ({ name: s.name, values: s.values, color: resolveIn(scope, seriesColor(i, s.color), "#F2620A") }));
        const sliceColors = el.data.labels.map((_, i) => resolveIn(scope, seriesColor(i, undefined), "#F2620A"));
        const font = firstFamily(getComputedStyle(scope).fontFamily);
        if (font) fonts.add(font);
        items.push({
          ...base,
          kind: "chart",
          chart: el.chart,
          labels: el.data.labels,
          series,
          sliceColors,
          stacked: !!el.options?.stacked,
          legend: el.options?.legend ?? el.data.series.length > 1,
          values: !!el.options?.values,
          text: resolveIn(scope, "var(--fg, #F5F7FA)"),
          muted: resolveIn(scope, "var(--muted, #8B93A7)"),
          font,
          fontSize: Math.max(12, Math.min(28, el.h / 22)),
        });
        break;
      }
      case "code": {
        const pre = node.querySelector("pre");
        if (!pre) {
          raster("code not drawn");
          break;
        }
        const pcs = getComputedStyle(pre);
        const lines = Array.from(pre.querySelectorAll<HTMLElement>("[data-line]")).map((line) => runsOf(line));
        const highlight = Array.from(pre.querySelectorAll<HTMLElement>("[data-line][data-highlighted]")).map((l) => {
          const top = l.getBoundingClientRect().top - node.getBoundingClientRect().top;
          return { y: top, h: l.offsetHeight };
        });
        const lineHeightPx = parseFloat(pcs.lineHeight) || (parseFloat(pcs.fontSize) || 24) * 1.5;
        const paddingTop = parseFloat(pcs.paddingTop) || 0;
        const font = firstFamily(pcs.fontFamily);
        if (font) fonts.add(font);
        items.push({
          ...base,
          kind: "code",
          lines,
          background: cssColorToRgba(pcs.backgroundColor) ?? { hex: "0D1117", alpha: 1 },
          highlight,
          highlightFill: (pre.querySelector("[data-highlighted]") && cssColorToRgba(getComputedStyle(pre.querySelector("[data-highlighted]")!).backgroundColor)) ?? { hex: "F2620A", alpha: 0.18 },
          lineHeightPx,
          paddingTop,
          fontSize: parseFloat(pcs.fontSize) || 24,
          font,
        });
        break;
      }
      case "icon":
        raster("icon");
        break;
      case "video":
        raster("video placeholder");
        break;
      case "group":
        raster("rotated group");
        break;
      default:
        break;
    }
  }
  return { page: index, slideId, step: stepAttr !== undefined ? Number(stepAttr) : null, background, items };
}

export function extractLayout(data: DeckData): Layout {
  const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-print-page]"));
  const rasters: RasterRef[] = [];
  const fonts = new Set<string>();
  const slides = pages
    .map((page, i) => extractPage(page, i, data, rasters, fonts))
    .filter((s): s is SlideLayout => s !== null);
  const deck: Deck = data.deck;
  return {
    width: deck.format.width,
    height: deck.format.height,
    title: deck.title ?? null,
    slides,
    rasters,
    fonts: Array.from(fonts),
  };
}

// ── isolation for rasters ───────────────────────────────────────────────────

type Saved = { el: HTMLElement; style: string | null };
let saved: Saved[] = [];

function remember(el: HTMLElement) {
  saved.push({ el, style: el.getAttribute("style") });
}

export function restore() {
  for (const { el, style } of saved.reverse()) {
    if (style === null) el.removeAttribute("style");
    else el.setAttribute("style", style);
  }
  saved = [];
}

/**
 * Leaves only one raster visible: an element (unrotated, on a transparent
 * page) or a slide background (no elements). Returns the CSS selector to
 * screenshot, or null when it is not on the page.
 */
export function isolate(ref: RasterRef): string | null {
  restore();
  const page = document.querySelector<HTMLElement>(`[data-print-page="${ref.page}"]`);
  const canvas = page?.querySelector<HTMLElement>("[data-slide-id]");
  if (!page || !canvas) return null;
  const all = Array.from(canvas.querySelectorAll<HTMLElement>("[data-element-id]"));
  if (ref.elementId === null) {
    for (const el of all) {
      remember(el);
      el.style.visibility = "hidden";
    }
    return `[data-print-page="${ref.page}"]`;
  }
  const target = canvas.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(ref.elementId)}"]`);
  if (!target) return null;
  for (const el of [document.documentElement, document.body, page, canvas]) {
    remember(el);
    el.style.background = "transparent";
  }
  canvas.querySelectorAll<HTMLElement>("[data-background]").forEach((el) => {
    remember(el);
    el.style.visibility = "hidden";
  });
  for (const el of all) {
    if (target.contains(el) && el !== target) continue; // children of a rasterized group stay
    remember(el);
    el.style.visibility = "hidden";
  }
  remember(target);
  target.style.visibility = "visible";
  target.style.transform = "none";
  target.style.opacity = "1";
  return `[data-print-page="${ref.page}"] [data-element-id="${ref.elementId}"]`;
}

export function installExportApi(data: DeckData) {
  (window as unknown as { __forgeDeck: unknown }).__forgeDeck = {
    extract: () => extractLayout(data),
    isolate,
    restore,
    stepsOf: (slide: Slide) => buildSchedule(slide).steps,
  };
}
