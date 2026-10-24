import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { designSystemSchema } from "@/lib/contracts/forge-design";
import { renderWithProviders, screen } from "@/test/render";
import { ComponentShowcase } from "./ComponentShowcase";
import { ColorsSection, LogoSection } from "./sections";
import {
  colorEntries,
  contrastRatio,
  contrastRows,
  cssVars,
  fontFamily,
  googleFontsHref,
  logoRules,
  scaleSizes,
  setColor,
  setDimension,
  setFont,
  setGuidance,
  setLogo,
  setTypeScale,
  typeScale,
  wcagLevel,
  type DesignSystemDoc,
} from "./tokens";

vi.mock("./api", () => ({
  assetObjectUrl: vi.fn(async () => null),
  uploadLogo: vi.fn(),
}));

/** A kit written by the API (same code as the AI): the editor must read it as is. */
function kit(id = "design-system-saas"): DesignSystemDoc {
  const file = path.join(process.cwd(), "..", "..", "data", "templates", id, "design-system.json");
  return JSON.parse(readFileSync(file, "utf8")) as DesignSystemDoc;
}

describe("design system tokens", () => {
  it("computes WCAG contrast like the API", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(wcagLevel(4.6)).toBe("AA");
    expect(wcagLevel(3.1)).toBe("AA-large");
    expect(wcagLevel(2)).toBe("fail");
    const rows = contrastRows(kit());
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((row) => row.pass)).toBe(true);
  });

  it("edits colours, fonts and scale immutably and stays valid", () => {
    const doc = kit();
    let next = setColor(doc, "accent", "#B91C1C");
    next = setFont(next, "display", "Fraunces");
    next = setTypeScale(next, 18, 1.333);
    next = setDimension(next, "radius", "md", 12);
    next = setGuidance(next, "voice", { summary: "Calme.", do: ["Court", " "], dont: [] });
    expect(colorEntries(doc).find((c) => c.name === "accent")?.value).toBe("#2563eb");
    expect(colorEntries(next).find((c) => c.name === "accent")?.value).toBe("#b91c1c");
    expect(fontFamily(next, "display")).toBe("Fraunces");
    expect(typeScale(next)).toEqual({ base: 18, ratio: 1.333 });
    expect(next.voice).toEqual({ summary: "Calme.", do: ["Court"] });
    expect(designSystemSchema.safeParse(next).success).toBe(true);
    // Unknown font or bad hex: unchanged.
    expect(setFont(doc, "body", "Comic Papyrus")).toBe(doc);
    expect(setColor(doc, "accent", "red")).toBe(doc);
  });

  it("keeps a readable floor on the small type steps", () => {
    const sizes = scaleSizes(16, 1.5);
    expect(sizes.xs).toBeGreaterThanOrEqual(12);
    expect(sizes["5xl"]).toBe(182);
  });

  it("splits logo usage from misuse", () => {
    const doc = kit();
    const rules = logoRules(doc);
    expect(rules.misuse.length).toBeGreaterThan(0);
    const next = setLogo(doc, { misuse: ["Jamais en rose"] });
    expect(logoRules(next).misuse).toEqual(["Jamais en rose"]);
    expect(next.logo?.usage?.at(-1)).toBe("Avoid: Jamais en rose");
  });

  it("maps tokens to CSS variables and a Google Fonts URL", () => {
    const vars = cssVars(kit("design-system-luxe"));
    expect(vars["--accent"]).toBe("#c8a96a");
    expect(vars["--font-display"]).toContain('"Cormorant Garamond"');
    expect(vars["--font-sans"]).toBe(vars["--font-body"]);
    expect(googleFontsHref(["Cormorant Garamond", "Nope"])).toBe(
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap",
    );
  });
});

describe("design system editor parts", () => {
  it("renders the showcase from the tokens", () => {
    const vars = cssVars(kit());
    renderWithProviders(<ComponentShowcase vars={vars} components={["button", "alert"]} />);
    const showcase = screen.getByTestId("ds-showcase");
    expect(showcase.style.getPropertyValue("--accent")).toBe("#2563eb");
    expect(screen.getByRole("button", { name: "Action principale" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("edits a colour from the hex field and shows the contrast table", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<ColorsSection doc={kit()} onChange={onChange} />);
    expect(screen.getByText("Contrastes vérifiés (WCAG 2.2)")).toBeTruthy();
    const hex = screen.getByLabelText("accent hex");
    await user.clear(hex);
    await user.type(hex, "#123456");
    hex.blur();
    const next = onChange.mock.calls.at(-1)?.[0] as DesignSystemDoc;
    expect(colorEntries(next).find((c) => c.name === "accent")?.value).toBe("#123456");
  });

  it("is read only for team members", () => {
    renderWithProviders(
      <LogoSection doc={kit()} onChange={vi.fn()} readOnly projectId="p1" onDocument={vi.fn()} onAsk={vi.fn()} />,
    );
    expect(screen.queryByText("Importer le logo")).toBeNull();
  });
});
