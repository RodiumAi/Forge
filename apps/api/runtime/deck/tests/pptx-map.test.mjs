import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import {
  chartToPptx,
  EMU_PER_PX,
  fontFace,
  fontWarnings,
  injectTransition,
  paragraphsToText,
  position,
  pxToEmu,
  pxToIn,
  pxToPt,
  slideSizeInches,
  tableToPptx,
  transitionXml,
  transparency,
} from "../pptx-map.mjs";
import { buildPptx } from "../pptx.mjs";

const white = { hex: "FFFFFF", alpha: 1 };

test("canvas pixels map to inches, EMU and points", () => {
  assert.equal(EMU_PER_PX, 6350);
  assert.equal(pxToIn(1920), 13.3333);
  assert.equal(pxToIn(144), 1);
  assert.equal(pxToEmu(1920), 12192000);
  assert.equal(pxToEmu(1080), 6858000);
  assert.equal(pxToPt(96), 48);
  assert.deepEqual(slideSizeInches(1920, 1080), { width: 13.3333, height: 7.5 });
  assert.deepEqual(slideSizeInches(1440, 1080), { width: 10, height: 7.5 });
  assert.deepEqual(slideSizeInches(1080, 1080), { width: 7.5, height: 7.5 });
});

test("boxes become positions, with rotation normalised", () => {
  assert.deepEqual(position({ x: 144, y: 72, w: 288, h: 144, rotate: 0 }), { x: 1, y: 0.5, w: 2, h: 1 });
  assert.equal(position({ x: 0, y: 0, w: 10, h: 10, rotate: -30 }).rotate, 330);
  assert.equal(transparency(0.5), 50);
  assert.equal(transparency(0.5, 0.5), 75);
  assert.equal(transparency(undefined), 0);
});

test("paragraphs keep runs, bullets, levels, links and exact line spacing", () => {
  const paras = [
    { runs: [{ text: "Hello ", size: 64, color: white, font: "Inter", bold: true }, { text: "world", size: 64, color: { hex: "F2620A", alpha: 1 }, italic: true, link: "https://example.com" }], align: "center", bullet: null, level: 0, lineHeight: 1.2, lineHeightPx: 76.8 },
    { runs: [{ text: "Item", size: 32, color: white, font: "Inter" }], align: "left", bullet: "number", level: 1, lineHeight: 1.2, lineHeightPx: 38.4 },
  ];
  const text = paragraphsToText(paras);
  assert.equal(text.length, 3);
  assert.equal(text[0].options.align, "center");
  assert.equal(text[0].options.lineSpacing, 38.4);
  assert.equal(text[0].options.fontSize, 32);
  assert.equal(text[0].options.bold, true);
  assert.equal(text[1].options.breakLine, true);
  assert.deepEqual(text[1].options.hyperlink, { url: "https://example.com" });
  assert.deepEqual(text[2].options.bullet, { type: "number" });
  assert.equal(text[2].options.indentLevel, 1);
  assert.equal(text[2].options.breakLine, undefined);
});

test("tables keep column proportions and the header fill", () => {
  const { rows, options } = tableToPptx({
    box: { x: 0, y: 0, w: 720, h: 144, rotate: 0, opacity: 1 },
    rows: [
      [{ runs: [{ text: "A", size: 24, color: white }], header: true }, { runs: [{ text: "B", size: 24, color: white }], header: true }],
      [{ runs: [{ text: "1", size: 24, color: white }], header: false }, { runs: [], header: false }],
    ],
    colWidths: [100, 300],
    headerFill: { hex: "151922", alpha: 1 },
    border: { hex: "2A3140", alpha: 1 },
    fontSize: 24,
  });
  assert.deepEqual(options.colW, [1.25, 3.75]);
  assert.equal(options.rowH, 0.5);
  assert.equal(rows[0][0].options.fill.color, "151922");
  assert.equal(rows[1][0].options.fill, undefined);
  assert.equal(rows[1][1].text[0].text, "");
});

test("charts become native series with resolved colors", () => {
  const base = { box: { x: 0, y: 0, w: 640, h: 360, rotate: 0, opacity: 1 }, labels: ["a", "b"], text: white, muted: white, font: "Inter", fontSize: 20, legend: true, values: false };
  const bar = chartToPptx({ ...base, chart: "bar", stacked: true, series: [{ name: "S1", values: [1, NaN], color: { hex: "F2620A", alpha: 1 } }, { name: "S2", values: [3, 4], color: { hex: "3B82F6", alpha: 1 } }], sliceColors: [] });
  assert.equal(bar.type, "bar");
  assert.equal(bar.options.barGrouping, "stacked");
  assert.deepEqual(bar.options.chartColors, ["F2620A", "3B82F6"]);
  assert.deepEqual(bar.data[0], { name: "S1", labels: ["a", "b"], values: [1, 0] });
  const pie = chartToPptx({ ...base, chart: "pie", stacked: false, series: [{ name: "P", values: [1, 2], color: white }, { name: "ignored", values: [9, 9], color: white }], sliceColors: [{ hex: "111111", alpha: 1 }, { hex: "222222", alpha: 1 }] });
  assert.equal(pie.data.length, 1);
  assert.deepEqual(pie.options.chartColors, ["111111", "222222"]);
  assert.equal(chartToPptx({ ...base, chart: "line", stacked: false, series: [], sliceColors: [] }).type, "line");
});

test("transitions map to PowerPoint markup with fallbacks", () => {
  assert.equal(transitionXml(null), null);
  assert.equal(transitionXml({ type: "none" }), null);
  const fade = transitionXml({ type: "fade", durationMs: 500 }).xml;
  assert.match(fade, /Requires="p14"><p:transition spd="fast" p14:dur="500"><p:fade\/><\/p:transition>/);
  assert.match(fade, /<mc:Fallback><p:transition spd="fast"><p:fade\/><\/p:transition><\/mc:Fallback>/);
  assert.match(transitionXml({ type: "push", direction: "up" }).xml, /<p:push dir="u"\/>/);
  assert.match(transitionXml({ type: "slide", direction: "right" }).xml, /<p:cover dir="r"\/>/);
  assert.match(transitionXml({ type: "zoom-out" }).xml, /<p:zoom dir="out"\/>/);
  const morph = transitionXml({ type: "morph", durationMs: 1200 }).xml;
  assert.match(morph, /xmlns:p159="http:\/\/schemas\.microsoft\.com\/office\/powerpoint\/2015\/09\/main"/);
  assert.match(morph, /Requires="p159"><p:transition spd="slow" p14:dur="1200"><p159:morph option="byObject"\/>/);
  assert.match(morph, /<mc:Fallback><p:transition spd="slow"><p:fade\/>/);
  assert.match(transitionXml({ type: "curtain" }).xml, /Requires="p15">.*<p15:prstTrans prst="curtains"\/>/);
  const cube = transitionXml({ type: "cube" });
  assert.equal(cube.warning.code, "TRANSITION_APPROXIMATED");
});

test("transition markup goes after clrMapOvr, once", () => {
  const slide = '<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  const out = injectTransition(slide, "<T/>");
  assert.equal(out, '<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><T/></p:sld>');
  assert.equal(injectTransition(out.replace("<T/>", "<p:transition/>"), "<U/>").includes("<U/>"), false);
  assert.equal(injectTransition("<p:sld><p:cSld/></p:sld>", "<T/>"), "<p:sld><p:cSld/><T/></p:sld>");
});

test("Google fonts are kept and reported, generic families become Office fonts", () => {
  assert.deepEqual(fontFace("Inter"), { face: "Inter", missing: true, nearest: "Arial" });
  assert.equal(fontFace("system-ui").face, "Segoe UI");
  assert.equal(fontFace("Georgia").missing, false);
  assert.equal(fontFace("Some Mono Font").nearest, "Consolas");
  const warnings = fontWarnings(["Inter", "Inter", "Arial", "Playfair Display"]);
  assert.deepEqual(warnings.map((w) => [w.font, w.fallback]), [["Inter", "Arial"], ["Playfair Display", "Georgia"]]);
});

test("buildPptx writes slides, notes and transitions", async () => {
  const layout = {
    width: 1920,
    height: 1080,
    title: "T",
    fonts: ["Inter"],
    rasters: [],
    slides: [
      { page: 0, slideId: "a", step: null, background: { type: "color", color: { hex: "0B0D12", alpha: 1 } }, items: [
        { kind: "text", id: "t", matchKey: "title", box: { x: 100, y: 100, w: 800, h: 200, rotate: 0, opacity: 1 }, valign: "top", paras: [{ runs: [{ text: "Hi", size: 96, color: white, font: "Inter" }], align: "left", bullet: null, level: 0, lineHeight: 1.2, lineHeightPx: 115.2 }] },
        { kind: "shape", id: "r", shape: "rect", box: { x: 0, y: 0, w: 100, h: 100, rotate: 0, opacity: 1 }, fill: white, line: null, radius: 10 },
        { kind: "shape", id: "l", shape: "arrow", box: { x: 0, y: 200, w: 300, h: 20, rotate: 45, opacity: 1 }, fill: null, line: { color: white, width: 4 }, radius: 0 },
      ] },
      { page: 1, slideId: "b", step: null, background: { type: "color", color: white }, items: [] },
    ],
  };
  const { buffer, warnings, slides } = await buildPptx({
    layout,
    transitions: { b: { type: "morph" } },
    notes: { a: "Speaker" },
    animated: false,
  });
  assert.equal(slides, 2);
  const zip = await JSZip.loadAsync(buffer);
  const s1 = await zip.file("ppt/slides/slide1.xml").async("string");
  const s2 = await zip.file("ppt/slides/slide2.xml").async("string");
  assert.match(s1, /name="!!title"/);
  assert.match(s1, /roundRect/);
  assert.match(s1, /tailEnd type="triangle"/);
  assert.doesNotMatch(s1, /p:transition/);
  assert.match(s2, /p159:morph/);
  const notes = Object.keys(zip.files).filter((n) => /notesSlides\/notesSlide\d+\.xml$/.test(n));
  const notesText = await Promise.all(notes.map((n) => zip.file(n).async("string")));
  assert.ok(notesText.some((x) => x.includes("Speaker")));
  assert.deepEqual(warnings.map((w) => w.code), ["FONT_NOT_EMBEDDED"]);
});
