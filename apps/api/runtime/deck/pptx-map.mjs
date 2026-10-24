/**
 * Pure mapping from the extracted deck layout (src/extract.ts) to pptxgenjs
 * options, and the slide transition XML added after generation. Kept apart
 * from pptx.mjs so it can be tested without writing files.
 *
 * Units: the canvas is 1920 x 1080 (16:9), 1440 x 1080 (4:3) or 1080 x 1080
 * (1:1) pixels and maps to 13.333 x 7.5, 10 x 7.5 or 7.5 x 7.5 inches, so
 * 144 canvas pixels make one inch and one pixel is half a point.
 */

export const PX_PER_INCH = 144;
export const EMU_PER_INCH = 914400;
export const EMU_PER_PX = EMU_PER_INCH / PX_PER_INCH; // 6350

export const pxToIn = (px) => Math.round((px / PX_PER_INCH) * 10000) / 10000;
export const pxToEmu = (px) => Math.round(px * EMU_PER_PX);
export const pxToPt = (px) => Math.round((px / 2) * 100) / 100;

/** Slide size in inches for a canvas size. */
export function slideSizeInches(width, height) {
  return { width: pxToIn(width), height: pxToIn(height) };
}

/** Box (canvas px) to pptxgenjs position options (inches). */
export function position(box) {
  const out = { x: pxToIn(box.x), y: pxToIn(box.y), w: pxToIn(Math.max(box.w, 1)), h: pxToIn(Math.max(box.h, 1)) };
  if (box.rotate) out.rotate = ((Math.round(box.rotate * 100) / 100) % 360 + 360) % 360;
  return out;
}

/** Transparency percent (0 opaque, 100 invisible) from alphas multiplied together. */
export function transparency(...alphas) {
  const a = alphas.reduce((acc, v) => acc * (typeof v === "number" ? v : 1), 1);
  return Math.max(0, Math.min(100, Math.round((1 - a) * 100)));
}

// ── fonts ──────────────────────────────────────────────────────────────────

/** Fonts PowerPoint has on Windows and macOS: no warning for these. */
const OFFICE_FONTS = new Set(
  [
    "Arial",
    "Arial Black",
    "Arial Narrow",
    "Calibri",
    "Calibri Light",
    "Cambria",
    "Candara",
    "Century Gothic",
    "Consolas",
    "Constantia",
    "Corbel",
    "Courier New",
    "Garamond",
    "Georgia",
    "Gill Sans MT",
    "Helvetica",
    "Helvetica Neue",
    "Impact",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
    "Aptos",
  ].map((f) => f.toLowerCase()),
);

const GENERIC = {
  "system-ui": "Segoe UI",
  "sans-serif": "Arial",
  serif: "Georgia",
  monospace: "Consolas",
  "ui-monospace": "Consolas",
  "ui-sans-serif": "Arial",
  "ui-serif": "Georgia",
  "-apple-system": "Segoe UI",
  blinkmacsystemfont: "Segoe UI",
};

/** Closest Office font for common Google Fonts (suggested in the warning). */
const NEAREST = {
  inter: "Arial",
  roboto: "Arial",
  "open sans": "Segoe UI",
  lato: "Calibri",
  montserrat: "Century Gothic",
  poppins: "Century Gothic",
  raleway: "Century Gothic",
  nunito: "Calibri",
  "dm sans": "Arial",
  manrope: "Arial",
  "space grotesk": "Arial",
  "ibm plex sans": "Arial",
  "plus jakarta sans": "Arial",
  "work sans": "Arial",
  "source sans 3": "Calibri",
  oswald: "Arial Narrow",
  "bebas neue": "Impact",
  "playfair display": "Georgia",
  merriweather: "Georgia",
  lora: "Georgia",
  "pt serif": "Georgia",
  "eb garamond": "Garamond",
  "cormorant garamond": "Garamond",
  "libre baskerville": "Georgia",
  "dm serif display": "Georgia",
  "jetbrains mono": "Consolas",
  "fira code": "Consolas",
  "source code pro": "Consolas",
  "ibm plex mono": "Consolas",
  "roboto mono": "Consolas",
  "space mono": "Courier New",
};

/**
 * Typeface written in the file. Generic families become an Office font; a
 * named family is kept (PowerPoint uses it when installed, else substitutes)
 * and reported with the Office font that comes closest.
 * @returns {{ face: string, missing: boolean, nearest: string }}
 */
export function fontFace(family) {
  const name = String(family || "").trim();
  const key = name.toLowerCase();
  if (!name) return { face: "Arial", missing: false, nearest: "Arial" };
  if (GENERIC[key]) return { face: GENERIC[key], missing: false, nearest: GENERIC[key] };
  if (OFFICE_FONTS.has(key)) return { face: name, missing: false, nearest: name };
  return { face: name, missing: true, nearest: NEAREST[key] ?? (/mono|code/.test(key) ? "Consolas" : /serif/.test(key) && !/sans/.test(key) ? "Georgia" : "Arial") };
}

/** Warnings for every named family the file uses that Office does not ship. */
export function fontWarnings(families) {
  const out = [];
  const seen = new Set();
  for (const family of families) {
    const f = fontFace(family);
    if (!f.missing || seen.has(f.face)) continue;
    seen.add(f.face);
    out.push({ code: "FONT_NOT_EMBEDDED", font: f.face, fallback: f.nearest, message: `Install "${f.face}" (Google Fonts) to see the deck as designed; otherwise PowerPoint substitutes a font such as ${f.nearest}.` });
  }
  return out;
}

// ── text ───────────────────────────────────────────────────────────────────

/** One run of the layout to a pptxgenjs text object. */
export function runOptions(run, opacity = 1) {
  const options = {
    bold: !!run.bold,
    italic: !!run.italic,
    color: run.color?.hex ?? "000000",
    fontSize: pxToPt(run.size ?? 32),
    fontFace: fontFace(run.font).face,
  };
  const t = transparency(run.color?.alpha, opacity);
  if (t > 0) options.transparency = t;
  if (run.underline) options.underline = { style: "sng" };
  if (run.strike) options.strike = "sngStrike";
  if (run.link && /^https:\/\//.test(run.link)) options.hyperlink = { url: run.link };
  return options;
}

const ALIGN = { left: "left", center: "center", right: "right", justify: "justify" };

/**
 * Paragraphs to the pptxgenjs text array: one entry per run, paragraph
 * options on its first run, `breakLine` closing each paragraph.
 */
export function paragraphsToText(paras, opacity = 1) {
  const out = [];
  paras.forEach((para, i) => {
    const runs = para.runs.length ? para.runs : [{ text: "", size: 32, color: { hex: "000000", alpha: 1 } }];
    runs.forEach((run, j) => {
      const options = runOptions(run, opacity);
      if (j === 0) {
        options.align = ALIGN[para.align] ?? "left";
        // Exact spacing in points: CSS line-height has no PowerPoint "multiple" equivalent
        // (PowerPoint's single spacing is about 1.2 em and varies with the font).
        if (para.lineHeightPx) options.lineSpacing = pxToPt(para.lineHeightPx);
        else if (para.lineHeight) options.lineSpacingMultiple = Math.max(0.5, Math.min(9.99, para.lineHeight / 1.2));
        if (para.bullet) {
          options.bullet = para.bullet === "number" ? { type: "number" } : true;
          options.indentLevel = para.level ?? 0;
        }
      }
      // A <br> inside a paragraph is a soft break (shift+enter) before the next run.
      if (j > 0 && runs[j - 1].breakLine) options.softBreakBefore = true;
      if (j === runs.length - 1 && i < paras.length - 1) options.breakLine = true;
      out.push({ text: run.text ?? "", options });
    });
  });
  return out;
}

// ── tables ─────────────────────────────────────────────────────────────────

/** Table item to pptxgenjs rows and options. */
export function tableToPptx(item) {
  const border = { type: "solid", pt: 0.75, color: item.border?.hex ?? "7F7F7F" };
  const rows = item.rows.map((row) =>
    row.map((cell) => {
      const runs = cell.runs.length ? cell.runs : [{ text: "", size: item.fontSize, color: { hex: "000000", alpha: 1 } }];
      const text = runs.map((run) => ({ text: run.text ?? "", options: runOptions(run, item.box?.opacity ?? 1) }));
      const options = { border: [border, border, border, border], margin: [pxToPt(item.fontSize * 0.35), pxToPt(item.fontSize * 0.6), pxToPt(item.fontSize * 0.35), pxToPt(item.fontSize * 0.6)], valign: "middle" };
      if (cell.header) {
        options.bold = true;
        if (item.headerFill) options.fill = { color: item.headerFill.hex, transparency: transparency(item.headerFill.alpha) };
      }
      return { text, options };
    }),
  );
  const total = item.colWidths.reduce((a, b) => a + b, 0) || item.box.w;
  const colW = item.colWidths.map((w) => pxToIn((w / total) * item.box.w));
  const rowH = item.rows.length ? pxToIn(item.box.h / item.rows.length) : undefined;
  return { rows, options: { ...position(item.box), colW, rowH, fontSize: pxToPt(item.fontSize), autoPage: false } };
}

// ── charts ─────────────────────────────────────────────────────────────────

/** Chart item to [type, data, options] for `slide.addChart`. */
export function chartToPptx(item) {
  const type = item.chart === "pie" ? "pie" : item.chart === "line" ? "line" : "bar";
  const data = (item.chart === "pie" ? item.series.slice(0, 1) : item.series).map((s) => ({
    name: s.name,
    labels: item.labels,
    values: item.labels.map((_, i) => (Number.isFinite(s.values[i]) ? s.values[i] : 0)),
  }));
  const colors = item.chart === "pie" ? item.sliceColors.map((c) => c.hex) : item.series.map((s) => s.color.hex);
  const font = fontFace(item.font).face;
  const size = pxToPt(item.fontSize);
  const options = {
    ...position(item.box),
    chartColors: colors,
    showLegend: !!item.legend,
    legendPos: "b",
    legendColor: item.text.hex,
    legendFontFace: font,
    legendFontSize: size,
    showValue: !!item.values,
    // pptxgenjs defaults to whole numbers (1.2 would read 1).
    dataLabelFormatCode: "General",
    valAxisLabelFormatCode: "General",
    dataLabelColor: item.text.hex,
    dataLabelFontFace: font,
    dataLabelFontSize: size,
    catAxisLabelColor: item.muted.hex,
    valAxisLabelColor: item.muted.hex,
    catAxisLabelFontFace: font,
    valAxisLabelFontFace: font,
    catAxisLabelFontSize: size,
    valAxisLabelFontSize: size,
    valGridLine: { color: item.muted.hex, style: "solid", size: 0.5 },
    catGridLine: { style: "none" },
  };
  if (type === "bar") {
    options.barDir = "col";
    options.barGrouping = item.stacked ? "stacked" : "clustered";
    if (item.stacked) options.barGapWidthPct = 60;
  }
  if (type === "line") {
    options.lineSize = 2;
    options.lineDataSymbol = "circle";
  }
  if (type === "pie") {
    options.showPercent = false;
    options.showLegend = item.legend !== false;
  }
  return { type, data, options };
}

// ── transitions ────────────────────────────────────────────────────────────

const NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main";
const NS_P15 = "http://schemas.microsoft.com/office/powerpoint/2012/main";
const NS_P159 = "http://schemas.microsoft.com/office/powerpoint/2015/09/main";

/** Default durations, mirroring the player (animations.ts). */
const DEFAULT_MS = { fade: 500, push: 600, slide: 600, wipe: 700, "zoom-in": 600, "zoom-out": 600, dissolve: 700, curtain: 900, cube: 800, morph: 800 };

const SIDE = { left: "l", right: "r", up: "u", down: "d" };

function speed(ms) {
  return ms <= 500 ? "fast" : ms <= 800 ? "med" : "slow";
}

/**
 * `<p:transition>` markup for a catalogue transition, or null for "none".
 * Duration rides as p14:dur inside mc:AlternateContent (PowerPoint 2010+),
 * with a plain fallback for older readers. Morph uses p159:morph (PowerPoint
 * 2019 / 365) and falls back to a fade. Returns `{ xml, warning? }`.
 */
export function transitionXml(transition) {
  if (!transition || transition.type === "none") return null;
  const type = transition.type;
  const ms = Math.max(50, Math.min(10000, transition.durationMs ?? DEFAULT_MS[type] ?? 500));
  const spd = speed(ms);
  const dir = SIDE[transition.direction ?? "left"] ?? "l";
  let warning;
  let body;
  let require = "p14";
  let extraNs = "";
  switch (type) {
    case "fade":
      body = "<p:fade/>";
      break;
    case "dissolve":
      body = "<p:dissolve/>";
      break;
    case "push":
      body = `<p:push dir="${dir}"/>`;
      break;
    case "slide":
      body = `<p:cover dir="${dir}"/>`;
      break;
    case "wipe":
      body = `<p:wipe dir="${dir}"/>`;
      break;
    case "zoom-in":
      body = '<p:zoom dir="in"/>';
      break;
    case "zoom-out":
      body = '<p:zoom dir="out"/>';
      break;
    case "cube":
      // No PowerPoint transition matches the light cube; push is the closest.
      body = `<p:push dir="${dir}"/>`;
      warning = { code: "TRANSITION_APPROXIMATED", transition: "cube", message: "The cube transition is exported as Push." };
      break;
    case "curtain":
      require = "p15";
      extraNs = ` xmlns:p15="${NS_P15}"`;
      body = '<p15:prstTrans prst="curtains"/>';
      break;
    case "morph":
      require = "p159";
      extraNs = ` xmlns:p159="${NS_P159}"`;
      body = '<p159:morph option="byObject"/>';
      break;
    default:
      body = "<p:fade/>";
      warning = { code: "TRANSITION_APPROXIMATED", transition: type, message: `The ${type} transition is exported as Fade.` };
  }
  const fallback = require === "p14" ? body : "<p:fade/>";
  const xml =
    `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
    `<mc:Choice xmlns:p14="${NS_P14}"${extraNs} Requires="${require}">` +
    `<p:transition spd="${spd}" p14:dur="${Math.round(ms)}">${body}</p:transition>` +
    `</mc:Choice>` +
    `<mc:Fallback><p:transition spd="${spd}">${fallback}</p:transition></mc:Fallback>` +
    `</mc:AlternateContent>`;
  return { xml, warning };
}

/**
 * Inserts transition markup in a slide part. Schema order inside p:sld is
 * cSld, clrMapOvr, transition, timing, extLst: it goes after clrMapOvr.
 */
export function injectTransition(slideXml, xml) {
  if (!xml) return slideXml;
  if (slideXml.includes("<p:transition") || slideXml.includes(":morph")) return slideXml;
  const marker = "</p:clrMapOvr>";
  const at = slideXml.indexOf(marker);
  if (at >= 0) return slideXml.slice(0, at + marker.length) + xml + slideXml.slice(at + marker.length);
  const end = slideXml.lastIndexOf("</p:sld>");
  if (end < 0) return slideXml;
  return slideXml.slice(0, end) + xml + slideXml.slice(end);
}
