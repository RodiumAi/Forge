import { describe, expect, it } from "vitest";
import {
  hexForColorInput,
  mergePalettes,
  parseCharterPalette,
  parseCharterTone,
  replaceCharterColor,
  replaceCssRootColor,
} from "./design-charter";

const KIT_MD = `# Design charter

## Template
- id: aurora-ai

## Colors
- --bg: #050208
- --fg: #f4f1fa
- --muted: #8b84a3
- --accent: #7c3aed

## Tone
Visionary, sleek, quietly confident.

## Do / Don't
- Do keep the aurora gradients.
`;

describe("parseCharterPalette", () => {
  it("extracts the kit palette in order", () => {
    expect(parseCharterPalette(KIT_MD)).toEqual([
      { name: "bg", hex: "#050208" },
      { name: "fg", hex: "#f4f1fa" },
      { name: "muted", hex: "#8b84a3" },
      { name: "accent", hex: "#7c3aed" },
    ]);
  });

  it("deduplicates repeated variables", () => {
    expect(parseCharterPalette("--bg: #fff\n--bg: #000")).toHaveLength(1);
  });

  it("returns empty for missing or colorless markdown", () => {
    expect(parseCharterPalette(null)).toEqual([]);
    expect(parseCharterPalette("# No colors here")).toEqual([]);
  });
});

describe("hex helpers", () => {
  it("expands short hex for color inputs", () => {
    expect(hexForColorInput("#abc")).toBe("#aabbcc");
  });
});

describe("replaceCharterColor", () => {
  it("rewrites the token and its color- twin", () => {
    const src = "--accent: #7c3aed;\n--color-accent: #7c3aed;";
    expect(replaceCharterColor(src, "accent", "#ff5500")).toBe(
      "--accent: #ff5500;\n--color-accent: #ff5500;",
    );
  });
});

describe("replaceCssRootColor", () => {
  it("updates :root tokens", () => {
    const css = ":root {\n  --bg: #050208;\n  --accent: #7c3aed;\n}";
    expect(replaceCssRootColor(css, "bg", "#111111")).toContain("--bg: #111111");
  });
});

describe("mergePalettes", () => {
  it("prefers short names over color- duplicates", () => {
    expect(
      mergePalettes(
        [{ name: "accent", hex: "#111111" }],
        [{ name: "color-accent", hex: "#111111" }, { name: "bg", hex: "#000000" }],
      ),
    ).toEqual([
      { name: "accent", hex: "#111111" },
      { name: "bg", hex: "#000000" },
    ]);
  });
});

describe("parseCharterTone", () => {
  it("reads the paragraph under the Tone heading", () => {
    expect(parseCharterTone(KIT_MD)).toBe("Visionary, sleek, quietly confident.");
  });

  it("accepts the french heading Ton", () => {
    expect(parseCharterTone("## Ton\nChaleureux et direct.")).toBe("Chaleureux et direct.");
  });

  it("returns null when absent", () => {
    expect(parseCharterTone("# Charter\n## Colors\n--bg: #fff")).toBeNull();
  });
});
