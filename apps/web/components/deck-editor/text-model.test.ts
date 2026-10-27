import { describe, expect, it } from "vitest";
import { textElementSchema } from "@/lib/contracts/forge-design";
import type { TextElement } from "./model";
import { cssToColor, docToText, plainText, safeLink, textToDoc } from "./text-model";

type Content = TextElement["content"];

const roundTrip = (content: Content) => docToText(textToDoc(content));

const valid = (content: Content) =>
  textElementSchema.safeParse({ id: "t", type: "text", x: 0, y: 0, w: 10, h: 10, content }).success;

describe("text model round trip", () => {
  it("keeps plain paragraphs as text", () => {
    const content: Content = [{ type: "paragraph", text: "Rapport annuel 2026" }];
    expect(roundTrip(content)).toEqual(content);
  });

  it("keeps runs with marks and theme colors", () => {
    const content: Content = [
      {
        type: "paragraph",
        runs: [
          { text: "Hello " },
          { text: "bold", bold: true },
          { text: " and ", italic: true, underline: true },
          { text: "link", link: "https://rodiumai.io" },
          { text: " accent", color: "--accent" },
          { text: " hex", color: "#ff0000" },
        ],
      },
    ];
    expect(roundTrip(content)).toEqual(content);
    expect(valid(roundTrip(content))).toBe(true);
  });

  it("keeps bullet and ordered lists with levels", () => {
    const content: Content = [
      {
        type: "bullet-list",
        items: [{ text: "One" }, { text: "Sub", level: 1 }, { text: "Deeper", level: 2 }, { text: "Two" }],
      },
      { type: "ordered-list", items: [{ text: "First" }, { runs: [{ text: "Second", bold: true }] }] },
    ];
    expect(roundTrip(content)).toEqual(content);
    expect(valid(roundTrip(content))).toBe(true);
  });

  it("turns line breaks into hard breaks and back", () => {
    const content: Content = [{ type: "paragraph", text: "Line 1\nLine 2" }];
    const doc = textToDoc(content);
    expect(doc.content?.[0].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(docToText(doc)).toEqual(content);
  });

  it("merges adjacent runs with the same marks", () => {
    const content = docToText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a", marks: [{ type: "bold" }] },
            { type: "text", text: "b", marks: [{ type: "bold" }] },
            { type: "text", text: "c" },
          ],
        },
      ],
    });
    expect(content).toEqual([{ type: "paragraph", runs: [{ text: "ab", bold: true }, { text: "c" }] }]);
  });

  it("drops links and colors the contract cannot store", () => {
    const content = docToText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
            { type: "text", text: "y", marks: [{ type: "textStyle", attrs: { color: "rgb(1,2,3)" } }] },
          ],
        },
      ],
    });
    expect(content).toEqual([{ type: "paragraph", text: "xy" }]);
  });

  it("caps list depth at level 4", () => {
    const nest = (depth: number): { type: string; content: unknown[] } => ({
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: `L${depth}` }] }, ...(depth < 6 ? [nest(depth + 1)] : [])] }],
    });
    const content = docToText({ type: "doc", content: [nest(0) as never] });
    expect(content[0].type === "bullet-list" && content[0].items.map((i) => i.level ?? 0)).toEqual([0, 1, 2, 3, 4, 4, 4]);
    expect(valid(content)).toBe(true);
  });

  it("gives an empty paragraph for an empty element", () => {
    expect(textToDoc([])).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(docToText({ type: "doc", content: [{ type: "paragraph" }] })).toEqual([{ type: "paragraph", text: "" }]);
  });
});

describe("helpers", () => {
  it("maps CSS colors back to contract colors", () => {
    expect(cssToColor("var(--accent)")).toBe("--accent");
    expect(cssToColor("#abc")).toBe("#abc");
    expect(cssToColor("red")).toBeUndefined();
  });

  it("forces https links", () => {
    expect(safeLink("http://a.b")).toBe("https://a.b");
    expect(safeLink("rodiumai.io/x")).toBe("https://rodiumai.io/x");
    expect(safeLink("mailto:x@y")).toBeUndefined();
  });

  it("extracts plain text", () => {
    expect(plainText([{ type: "paragraph", runs: [{ text: "A" }, { text: "B" }] }, { type: "bullet-list", items: [{ text: "C" }] }])).toBe("AB\nC");
  });
});
