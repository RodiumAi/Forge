import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colorRef, DEFAULT_TOKENS, fontRef, themeTokensFromDesign, tokensFromDesignSystem } from "./theme";

const FIXTURES = join(__dirname, "..", "..", "..", "..", "contracts", "forge-design", "fixtures", "valid");

describe("themeTokensFromDesign", () => {
  it("maps design-system.json: color.x to --x, other groups to --group-x", () => {
    const tokens = themeTokensFromDesign(readFileSync(join(FIXTURES, "design-system.default.json"), "utf8"));
    expect(tokens["--bg"]).toBe("#0B0D12");
    expect(tokens["--accent"]).toBe("#F2620A");
    expect(tokens["--font-display"]).toBe("Inter, sans-serif");
    expect(tokens["--font-mono"]).toBe("\"JetBrains Mono\", monospace");
    expect(tokens["--radius-md"]).toBe("8px");
    expect(tokens["--shadow-card"]).toBe("0px 4px 12px 0px #00000033");
    expect(tokens["--motion-fast"]).toBe("150ms");
    expect(tokens["--motion-ease"]).toBe("cubic-bezier(0.2, 0, 0, 1)");
  });

  it("joins nested groups and resolves aliases", () => {
    const tokens = tokensFromDesignSystem({
      color: { brand: { primary: { $value: "#123456" } }, link: { $value: "{color.brand.primary}" } },
      space: { $type: "dimension", sm: { $value: 4 } },
    });
    expect(tokens).toEqual({ "--brand-primary": "#123456", "--link": "var(--brand-primary)", "--space-sm": "4px" });
  });

  it("reads --name: value lines and font stacks of a DESIGN.md", () => {
    const md = [
      "# Design charter",
      "## Colors",
      "- --bg: #050208",
      "- --accent: #7c3aed",
      "## Typography",
      "- Font stack: -apple-system, \"Segoe UI\", Roboto, sans-serif (system fonts, no web fonts). Quote marks use Georgia.",
      "- Mono font: \"JetBrains Mono\", monospace",
    ].join("\n");
    const tokens = themeTokensFromDesign(md);
    expect(tokens["--bg"]).toBe("#050208");
    expect(tokens["--accent"]).toBe("#7c3aed");
    expect(tokens["--fg"]).toBe(DEFAULT_TOKENS["--fg"]);
    expect(tokens["--font-body"]).toBe("-apple-system, \"Segoe UI\", Roboto, sans-serif");
    expect(tokens["--font-display"]).toBe(tokens["--font-body"]);
    expect(tokens["--font-mono"]).toBe("\"JetBrains Mono\", monospace");
  });

  it("reads the charter token lines written by the kits and the brand charter", () => {
    const md = [
      "## Colors",
      "- `--bg`: #0D1B2A (slide background)",
      "- `--accent`: #48CAE4 (accent, links)",
      "- `--shadow`: rgba(0, 0, 0, 0.4)",
    ].join("\n");
    const tokens = themeTokensFromDesign(md);
    expect(tokens["--bg"]).toBe("#0D1B2A");
    expect(tokens["--accent"]).toBe("#48CAE4");
    expect(tokens["--shadow"]).toBe("rgba(0, 0, 0, 0.4)");
  });

  it("falls back to defaults on empty or broken input", () => {
    expect(themeTokensFromDesign("")).toEqual(DEFAULT_TOKENS);
    expect(themeTokensFromDesign("{ not json")).toEqual(DEFAULT_TOKENS);
  });

  it("resolves slide references", () => {
    expect(colorRef("--fg")).toBe("var(--fg)");
    expect(colorRef("#fff")).toBe("#fff");
    expect(colorRef(undefined, "red")).toBe("red");
    expect(fontRef("mono")).toBe("var(--font-mono, ui-monospace, monospace)");
  });
});
