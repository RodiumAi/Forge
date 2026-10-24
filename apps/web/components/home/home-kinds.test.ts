import { describe, expect, it } from "vitest";

import {
  HOME_TILES,
  buildCreateRequest,
  getTile,
  inferFormat,
  inferKind,
  visibleTiles,
  type HomeTileId,
} from "@/components/home/home-kinds";
import { createOptionsBody } from "@/lib/create-project";
import { KIND_IDS, type ProjectKindId } from "@/lib/kinds";

const ALL: ProjectKindId[] = [...KIND_IDS];
const WEB_ONLY: ProjectKindId[] = ["web", "mobile"];

function request(id: HomeTileId, text: string, enabled: ProjectKindId[] = ALL, designSystemId: string | null = null) {
  const tile = getTile(id);
  return buildCreateRequest({
    tile,
    text,
    enabled,
    designSystemId,
    shortcutLabel: tile.id === "social_carousel" ? "Carrousel réseaux sociaux" : tile.id,
    shortcutTemplate: "{type} : {text}",
  });
}

/** The extra POST /projects fields a home create sends. */
function body(id: HomeTileId, text: string, enabled: ProjectKindId[] = ALL, ds: string | null = null) {
  const r = request(id, text, enabled, ds);
  return { platform: r.platform, prompt: r.prompt, ...createOptionsBody(r.platform, r.options) };
}

describe("visibleTiles", () => {
  it("offers Blank, web and mobile (and the landing shortcut) while document kinds are off", () => {
    expect(visibleTiles(WEB_ONLY).map((t) => t.id)).toEqual(["blank", "web", "mobile", "landing_page"]);
  });

  it("offers every tile once every kind is on", () => {
    expect(visibleTiles(ALL).map((t) => t.id)).toEqual(HOME_TILES.map((t) => t.id));
  });

  it("shows a kind's shortcuts only with the kind", () => {
    const ids = visibleTiles(["web", "mobile", "slides"]).map((t) => t.id);
    expect(ids).toContain("pitch_deck");
    expect(ids).toContain("social_carousel");
    expect(ids).not.toContain("tutorial");
    expect(ids).not.toContain("palette");
    expect(ids).not.toContain("codelab");
  });
});

describe("inferKind", () => {
  it("reads the kind from French and English prompts", () => {
    expect(inferKind("Une présentation sur nos résultats 2026", ALL)).toBe("slides");
    expect(inferKind("A pitch deck for investors", ALL)).toBe("slides");
    expect(inferKind("Un tutoriel pour apprendre FastAPI", ALL)).toBe("codelab");
    expect(inferKind("Notre charte graphique et la palette", ALL)).toBe("design_system");
    expect(inferKind("Une application mobile de budget", ALL)).toBe("mobile");
    expect(inferKind("Un site vitrine pour un restaurant", ALL)).toBe("web");
  });

  it("never picks a disabled kind", () => {
    expect(inferKind("Une présentation sur nos résultats", WEB_ONLY)).toBe("web");
    expect(inferKind("Une application mobile de budget", WEB_ONLY)).toBe("mobile");
  });

  it("guesses the square format for carousels", () => {
    expect(inferFormat("Un carrousel Instagram de 6 slides")).toBe("1:1");
    expect(inferFormat("Slides au format 4:3")).toBe("4:3");
    expect(inferFormat("Une présentation classique")).toBeUndefined();
  });
});

describe("create payload per tile", () => {
  it("Blank infers the kind and sends no extra field for a site", () => {
    expect(body("blank", "Un site pour mon café")).toEqual({ platform: "web", prompt: "Un site pour mon café" });
  });

  it("Blank inferring slides sends the default 16:9 format", () => {
    expect(body("blank", "Une présentation de notre offre")).toMatchObject({ platform: "slides", format: "16:9" });
  });

  it("each kind tile sends its kind", () => {
    expect(body("web", "x").platform).toBe("web");
    expect(body("mobile", "x").platform).toBe("mobile");
    expect(body("codelab", "x")).toEqual({ platform: "codelab", prompt: "x" });
    expect(body("design_system", "x")).toEqual({ platform: "design_system", prompt: "x" });
    expect(body("slides", "x")).toEqual({ platform: "slides", prompt: "x", format: "16:9" });
  });

  it("a kind tile wins over the words of the prompt", () => {
    expect(body("web", "une présentation de mon agence").platform).toBe("web");
  });

  it("the social carousel is a square deck and names its sub-type", () => {
    expect(body("social_carousel", "5 astuces RodiumAi")).toEqual({
      platform: "slides",
      prompt: "Carrousel réseaux sociaux : 5 astuces RodiumAi",
      format: "1:1",
    });
  });

  it("the pitch deck stays 16:9 even when the text says carousel", () => {
    expect(body("pitch_deck", "carousel style")).toMatchObject({ platform: "slides", format: "16:9" });
  });

  it("shortcuts map to their kinds", () => {
    expect(body("landing_page", "x").platform).toBe("web");
    expect(body("tutorial", "x").platform).toBe("codelab");
    expect(body("palette", "x").platform).toBe("design_system");
  });

  it("carries the selected design system", () => {
    expect(body("slides", "x", ALL, "ds-1")).toEqual({
      platform: "slides",
      prompt: "x",
      format: "16:9",
      design_system_id: "ds-1",
    });
  });

  it("falls back to inference when a tile's kind was switched off meanwhile", () => {
    expect(body("slides", "Un site pour mon café", WEB_ONLY)).toEqual({
      platform: "web",
      prompt: "Un site pour mon café",
    });
  });
});
