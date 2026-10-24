import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deckSchema, slideSchema } from "../../lib/contracts/forge-design";
import { cropLayout, videoEmbedUrl } from "./elements";
import { SlideView } from "./SlideView";
import { themeTokensFromDesign } from "./theme";
import type { Deck, Slide } from "./types";

const FIXTURES = join(__dirname, "..", "..", "..", "..", "contracts", "forge-design", "fixtures", "valid");
const load = (name: string) => JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const deck: Deck = deckSchema.parse(load("deck.minimal.json"));
const full: Slide = slideSchema.parse(load("slide.full.json"));
const tokens = themeTokensFromDesign(readFileSync(join(FIXTURES, "design-system.default.json"), "utf8"));
const assetUrl = (p: string) => `/assets/${p}`;

function renderSlide(slide: Slide, mode: "edit" | "present" | "print" | "thumbnail" = "print", step?: number) {
  return render(<SlideView slide={slide} deck={deck} tokens={tokens} mode={mode} scale={0.5} step={step} assetUrl={assetUrl} />);
}

function byId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
  if (!el) throw new Error(`no element ${id}`);
  return el;
}

describe("SlideView", () => {
  it("renders every element type of slide.full.json", () => {
    const { container } = renderSlide(full);
    const types = new Set([...container.querySelectorAll("[data-element-type]")].map((el) => el.getAttribute("data-element-type")));
    expect(types).toEqual(new Set(["text", "image", "shape", "icon", "table", "chart", "video", "code", "group"]));
  });

  it("scales the canvas and exposes the theme tokens", () => {
    const { container } = renderSlide(full);
    const outer = container.querySelector<HTMLElement>("[data-deck-slide]")!;
    expect(outer.style.width).toBe("960px");
    expect(outer.style.height).toBe("540px");
    const canvas = container.querySelector<HTMLElement>("[data-slide-id='s2']")!;
    expect(canvas.style.getPropertyValue("--accent")).toBe("#F2620A");
    expect(canvas.style.width).toBe("1920px");
  });

  it("positions elements absolutely with z, rotation and opacity", () => {
    const { container } = renderSlide({
      id: "s",
      elements: [
        { id: "a", type: "shape", shape: "rect", x: 10, y: 20, w: 30, h: 40, z: 5, rotation: 15, opacity: 0.5 },
        { id: "b", type: "shape", shape: "rect", x: 0, y: 0, w: 1, h: 1, z: 1 },
      ],
    });
    const a = byId(container, "a");
    expect(a.style.left).toBe("10px");
    expect(a.style.top).toBe("20px");
    expect(a.style.width).toBe("30px");
    expect(a.style.zIndex).toBe("5");
    expect(a.style.transform).toBe("rotate(15deg)");
    expect(a.style.opacity).toBe("0.5");
    // Painted in z order.
    const order = [...container.querySelectorAll("[data-element-id]")].map((el) => el.getAttribute("data-element-id"));
    expect(order).toEqual(["b", "a"]);
  });

  it("renders rich text runs, lists and links with token colors", () => {
    const { container } = renderSlide(full);
    const title = byId(container, "title");
    expect(title.textContent).toContain("Rapport annuel");
    const italic = [...title.querySelectorAll("span")].find((s) => s.textContent === "annuel")!;
    expect(italic.style.fontStyle).toBe("italic");
    expect(italic.style.color).toBe("var(--accent)");
    expect(title.querySelector("ul li")).toBeTruthy();
    expect(title.querySelector("ol a")?.getAttribute("href")).toBe("https://example.com");
    const box = title.firstElementChild as HTMLElement;
    expect(box.style.fontSize).toBe("72px");
    expect(box.style.justifyContent).toBe("center");
  });

  it("renders images through assetUrl, with radius and credit", () => {
    const { container } = renderSlide(full);
    const hero = byId(container, "hero");
    expect(hero.querySelector("img")?.getAttribute("src")).toBe("/assets/public/images/hero.webp");
    expect(hero.querySelector("[data-credit]")?.textContent).toBe("Jane Doe / pixabay");
    const thumb = renderSlide(full, "thumbnail");
    expect(byId(thumb.container, "hero").querySelector("[data-credit]")).toBeNull();
  });

  it("computes the crop layout of an image", () => {
    const l = cropLayout({ width: 1000, height: 1000 }, { x: 0, y: 0.1, w: 1, h: 0.8 }, { w: 820, h: 1080 }, "cover");
    // The 1000 x 800 crop covers 820 x 1080: scale 1.35, centered horizontally.
    expect(l.width).toBeCloseTo(1350);
    expect(l.top).toBeCloseTo(-135);
    expect(l.left).toBeCloseTo((820 - 1350) / 2);
    const fill = cropLayout({ width: 100, height: 100 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { w: 200, h: 100 }, "fill");
    expect(fill).toEqual({ width: 400, height: 200, left: -200, top: -100 });
  });

  it("renders shapes, icons, tables, charts and code", () => {
    const { container } = renderSlide(full);
    expect(byId(container, "box").querySelector("rect")).toBeTruthy();
    expect(byId(container, "arrow").querySelector("path")).toBeTruthy();
    expect(byId(container, "ico").querySelector("svg")).toBeTruthy();
    const table = byId(container, "tbl");
    expect(table.querySelectorAll("th")).toHaveLength(2);
    expect(table.querySelectorAll("col")[0].getAttribute("style")).toContain("66.6");
    expect(table.querySelector("td span")?.textContent).toBe("12 M");
    const chart = byId(container, "chart");
    expect(chart.querySelector("svg[data-chart='bar']")).toBeTruthy();
    expect(chart.querySelectorAll("rect").length).toBeGreaterThanOrEqual(3);
    const code = byId(container, "code");
    expect(code.querySelector("[data-line='1'][data-highlighted]")).toBeTruthy();
    expect(code.querySelector("[data-token='string']")?.textContent).toBe("'hi'");
  });

  it("draws line and pie charts", () => {
    const { container } = renderSlide({
      id: "c",
      elements: [
        { id: "l", type: "chart", chart: "line", x: 0, y: 0, w: 600, h: 400, data: { labels: ["a", "b"], series: [{ name: "s", values: [1, 3] }] } },
        { id: "p", type: "chart", chart: "pie", x: 0, y: 0, w: 400, h: 400, data: { labels: ["a", "b"], series: [{ name: "s", values: [1, 3] }] }, options: { values: true } },
      ],
    });
    expect(byId(container, "l").querySelector("polyline")).toBeTruthy();
    expect(byId(container, "p").querySelectorAll("path")).toHaveLength(2);
  });

  it("nests groups relative to the group box", () => {
    const { container } = renderSlide(full);
    const grp = byId(container, "grp");
    expect(grp.querySelector("[data-element-id='grp-b'] [data-element-id='grp-c']")).toBeTruthy();
  });

  it("hides hidden elements except in the editor", () => {
    const slide: Slide = { id: "h", elements: [{ id: "x", type: "shape", shape: "rect", x: 0, y: 0, w: 1, h: 1, hidden: true }] };
    expect(renderSlide(slide, "print").container.querySelector("[data-element-id='x']")).toBeNull();
    expect(renderSlide(slide, "edit").container.querySelector("[data-element-id='x'][data-hidden]")).toBeTruthy();
  });

  it("embeds videos only when presenting", () => {
    expect(byId(renderSlide(full, "print").container, "vid").querySelector("[data-video-placeholder] img")?.getAttribute("src")).toBe("/assets/public/images/poster.webp");
    expect(byId(renderSlide(full, "present").container, "vid").querySelector("iframe")?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/abc?mute=1");
  });

  it("builds embed URLs for YouTube and Vimeo only", () => {
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { autoplay: true })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbedUrl("https://example.com/video.mp4")).toBeNull();
  });

  it("paints backgrounds: gradient, color, image with overlay", () => {
    const gradient = renderSlide(full).container.querySelector<HTMLElement>("[data-slide-id]")!;
    expect(gradient.style.background).toContain("linear-gradient(135deg");
    const image = renderSlide(slideSchema.parse(load("slide.image-background.json"))).container;
    expect(image.querySelector("[data-background='image'] img")?.getAttribute("src")).toBe("/assets/public/images/bg.webp");
  });

  it("shows only the elements reached at the current step when presenting", () => {
    const slide: Slide = {
      id: "st",
      elements: [
        { id: "a", type: "shape", shape: "rect", x: 0, y: 0, w: 1, h: 1, animation: { type: "appear", trigger: "on-click" } },
        { id: "b", type: "shape", shape: "rect", x: 0, y: 0, w: 1, h: 1, animation: { type: "appear", trigger: "on-click" } },
      ],
    };
    const { container } = renderSlide(slide, "present", 1);
    expect(byId(container, "a").getAttribute("data-step")).toBe("1");
    expect(byId(container, "b").getAttribute("data-step")).toBe("2");
    // print never animates: no step markers, everything at rest.
    expect(byId(renderSlide(slide, "print").container, "b").getAttribute("data-step")).toBeNull();
  });

  it("renders every element of the deepest group fixture", () => {
    const deep = slideSchema.parse(load("slide.group-depth-4.json"));
    const { container } = renderSlide(deep);
    expect(container.querySelectorAll("[data-element-type='group']").length).toBe(4);
  });
});
