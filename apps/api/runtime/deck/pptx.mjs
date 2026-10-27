#!/usr/bin/env node
/**
 * PPTX export of a Forge Design deck.
 *
 *   stdin JSON {
 *     layout,                       // from src/extract.ts (print page, read in Chromium)
 *     transitions: { [slideId]: Transition },
 *     notes: { [slideId]: string },
 *     images: { [itemKey]: { path, box? } },   // prepared by the API (fit and crop applied)
 *     rasters: { [rasterKey]: path },          // screenshots of what PowerPoint cannot draw
 *     animated: boolean,            // the deck has element animations
 *   }
 *   --out <file>   writes the .pptx, `{ ok, warnings, slides }` on stdout
 *
 * Text boxes, images, shapes, tables and charts are native and editable.
 * Slide transitions are added afterwards in the slide XML (pptxgenjs has no
 * API for them).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import {
  chartToPptx,
  fontFace,
  fontWarnings,
  injectTransition,
  paragraphsToText,
  position,
  pxToIn,
  pxToPt,
  runOptions,
  slideSizeInches,
  tableToPptx,
  transitionXml,
  transparency,
} from "./pptx-map.mjs";

export function itemKey(page, id) {
  return `${page}:${id}`;
}

function objectName(item) {
  // "!!" names make PowerPoint's Morph pair objects across slides.
  if (item.matchKey) return `!!${item.matchKey}`;
  return (item.name || item.id || "").slice(0, 120);
}

function hyperlink(item) {
  return item.link && /^https:\/\//.test(item.link) ? { url: item.link } : undefined;
}

function addText(slide, item) {
  const text = paragraphsToText(item.paras, item.box.opacity);
  const link = hyperlink(item);
  if (link) for (const t of text) t.options.hyperlink ??= link;
  slide.addText(text.length ? text : [{ text: "" }], {
    ...position(item.box),
    margin: 0,
    valign: item.valign,
    fit: "none",
    wrap: true,
    isTextBox: true,
    objectName: objectName(item),
  });
}

function addShape(pres, slide, item) {
  const box = item.box;
  const common = { objectName: objectName(item), hyperlink: hyperlink(item) };
  const fill = item.fill ? { color: item.fill.hex, transparency: transparency(item.fill.alpha, box.opacity) } : { type: "none" };
  const line = item.line
    ? { color: item.line.color.hex, width: pxToPt(item.line.width), transparency: transparency(item.line.color.alpha, box.opacity) }
    : { type: "none" };
  if (item.shape === "line" || item.shape === "arrow") {
    // Drawn through the middle of the box; rotation is around the same center.
    slide.addShape(pres.ShapeType.line, {
      ...position({ ...box, y: box.y + box.h / 2, h: 0 }),
      h: 0,
      line: { ...line, ...(item.shape === "arrow" ? { endArrowType: "triangle" } : {}) },
      ...common,
    });
    return;
  }
  if (item.shape === "ellipse") {
    slide.addShape(pres.ShapeType.ellipse, { ...position(box), fill, line, ...common });
    return;
  }
  if (item.radius > 0) {
    slide.addShape(pres.ShapeType.roundRect, { ...position(box), fill, line, rectRadius: pxToIn(item.radius), ...common });
    return;
  }
  slide.addShape(pres.ShapeType.rect, { ...position(box), fill, line, ...common });
}

function addCode(pres, slide, item) {
  const box = item.box;
  const em = item.fontSize;
  const lineH = item.lineHeightPx || em * 1.5;
  const padTop = item.paddingTop ?? em * 0.8;
  slide.addShape(pres.ShapeType.roundRect, {
    ...position(box),
    rectRadius: pxToIn(12),
    fill: { color: item.background.hex, transparency: transparency(item.background.alpha, box.opacity) },
    line: { type: "none" },
    objectName: `${objectName(item)} background`,
  });
  for (const row of item.highlight) {
    slide.addShape(pres.ShapeType.rect, {
      ...position({ x: box.x, y: box.y + row.y, w: box.w, h: row.h || lineH, rotate: box.rotate, opacity: 1 }),
      fill: { color: item.highlightFill.hex, transparency: transparency(item.highlightFill.alpha) },
      line: { type: "none" },
    });
  }
  const face = fontFace(item.font).face;
  const text = [];
  item.lines.forEach((runs, i) => {
    const list = runs.length ? runs : [{ text: " ", size: em, color: { hex: "E6EDF3", alpha: 1 } }];
    list.forEach((run, j) => {
      const options = { ...runOptions({ ...run, font: item.font }, box.opacity), fontFace: face };
      if (j === 0) options.lineSpacing = pxToPt(lineH);
      if (j === list.length - 1 && i < item.lines.length - 1) options.breakLine = true;
      text.push({ text: run.text, options });
    });
  });
  slide.addText(text, {
    ...position(box),
    margin: [pxToPt(padTop), pxToPt(em), pxToPt(padTop), pxToPt(em)],
    valign: "top",
    fit: "none",
    wrap: false,
    isTextBox: true,
    objectName: objectName(item),
  });
}

function addImage(slide, item, prepared) {
  if (!prepared?.path) return false;
  const box = prepared.box ? { ...item.box, ...prepared.box } : item.box;
  const options = {
    path: prepared.path,
    ...position(box),
    objectName: objectName(item),
    hyperlink: hyperlink(item),
  };
  if (item.alt) options.altText = item.alt.slice(0, 300);
  const t = transparency(box.opacity);
  if (t > 0) options.transparency = t;
  slide.addImage(options);
  return true;
}

/**
 * @returns {Promise<{ buffer: Buffer, warnings: object[], slides: number }>}
 */
export async function buildPptx(input) {
  const { layout, transitions = {}, notes = {}, images = {}, rasters = {} } = input;
  const pres = new PptxGenJS();
  const size = slideSizeInches(layout.width, layout.height);
  pres.defineLayout({ name: "FORGE", width: size.width, height: size.height });
  pres.layout = "FORGE";
  pres.title = layout.title ?? "Forge presentation";
  pres.company = "RodiumAi";
  pres.author = "Forge";

  const warnings = [];
  const rasterReasons = new Map();
  const transitionsBySlide = [];
  const seenSlide = new Set();

  for (const page of layout.slides) {
    const slide = pres.addSlide();
    if (page.background.type === "color") {
      slide.background = { color: page.background.color.hex };
    } else if (rasters[page.background.key]) {
      slide.background = { path: rasters[page.background.key] };
    }
    for (const item of page.items) {
      switch (item.kind) {
        case "text":
          addText(slide, item);
          break;
        case "image":
          if (!addImage(slide, item, images[itemKey(page.page, item.id)])) {
            warnings.push({ code: "IMAGE_MISSING", element: item.id, message: `Image ${item.src} could not be read.` });
          }
          break;
        case "shape":
          addShape(pres, slide, item);
          break;
        case "table": {
          const { rows, options } = tableToPptx(item);
          slide.addTable(rows, { ...options, objectName: objectName(item) });
          break;
        }
        case "chart": {
          const { type, data, options } = chartToPptx(item);
          slide.addChart(pres.ChartType[type], data, { ...options, objectName: objectName(item) });
          break;
        }
        case "code":
          addCode(pres, slide, item);
          break;
        case "raster": {
          const path = rasters[item.key];
          if (!path) {
            warnings.push({ code: "RASTER_MISSING", element: item.id, message: `Element ${item.id} could not be drawn.` });
            break;
          }
          rasterReasons.set(item.reason, (rasterReasons.get(item.reason) ?? 0) + 1);
          addImage(slide, { ...item, alt: undefined }, { path });
          break;
        }
        default:
          break;
      }
    }
    // Notes and the transition belong to the first page of a slide.
    const first = !seenSlide.has(page.slideId);
    seenSlide.add(page.slideId);
    if (first && notes[page.slideId]) slide.addNotes(String(notes[page.slideId]).slice(0, 20000));
    transitionsBySlide.push(first ? transitions[page.slideId] : null);
  }

  warnings.push(...fontWarnings(layout.fonts ?? []));
  if (rasterReasons.size) {
    const list = Array.from(rasterReasons.entries()).map(([reason, n]) => `${n} ${reason}`);
    warnings.push({ code: "RENDERED_AS_IMAGE", message: `Exported as pictures (PowerPoint has no equivalent): ${list.join(", ")}.` });
  }
  if (input.animated) {
    warnings.push({ code: "ANIMATIONS_NOT_EXPORTED", message: "Element animations are not exported; slide transitions are." });
  }

  let buffer = await pres.write({ outputType: "nodebuffer" });
  const marks = transitionsBySlide.map((t) => transitionXml(t));
  if (marks.some(Boolean)) {
    const zip = await JSZip.loadAsync(buffer);
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (!mark) continue;
      if (mark.warning && !warnings.some((w) => w.code === mark.warning.code && w.transition === mark.warning.transition)) {
        warnings.push(mark.warning);
      }
      const name = `ppt/slides/slide${i + 1}.xml`;
      const file = zip.file(name);
      if (!file) continue;
      zip.file(name, injectTransition(await file.async("string"), mark.xml));
    }
    buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
  return { buffer, warnings, slides: layout.slides.length };
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outfile = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (!outfile) throw new Error("usage: pptx.mjs --out <file> < input.json");
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { buffer, warnings, slides } = await buildPptx(input);
  writeFileSync(outfile, buffer);
  process.stdout.write(JSON.stringify({ ok: true, warnings, slides, bytes: buffer.length }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stdout.write(JSON.stringify({ ok: false, error: String(err?.stack ?? err).slice(0, 4000) }));
    process.exitCode = 1;
  });
}
