import { afterEach, describe, expect, it, vi } from "vitest";
import {
  badgeRemovable,
  DeckExportError,
  deckExportAllowed,
  decodeWarnings,
  exportDeck,
  exportFilename,
  presenterUrl,
  warningText,
} from "@/lib/deck-exports";
import type { ForgeStatus } from "@/lib/forge-status";

function status(plan: string | null, rights: Record<string, boolean> = {}): ForgeStatus {
  if (plan === null) return { frodi: null, rodi: null, plan: null, entitlements: null };
  return {
    frodi: 0,
    rodi: 0,
    plan,
    entitlements: {
      plan_slug: plan,
      status: "active",
      max_projects: 3,
      model_selection: false,
      custom_domain: false,
      export_enabled: false,
      history_enabled: false,
      priority_generation: false,
      allowed_model_tiers: null,
      frodi_balance: 0,
      ...rights,
    },
  };
}

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

afterEach(() => vi.unstubAllGlobals());

describe("deck export gates", () => {
  it("allow everything without a plan (open source, status not loaded)", () => {
    expect(deckExportAllowed(null, "pptx")).toBe(true);
    expect(deckExportAllowed(status(null), "html")).toBe(true);
    expect(badgeRemovable(null)).toBe(true);
  });

  it("refuse every format on Free, even with stale rights", () => {
    const free = status("free", { export_pdf: true, export_html: true, export_pptx: true, remove_badge: true });
    for (const f of ["pdf", "png", "html", "pptx"] as const) expect(deckExportAllowed(free, f)).toBe(false);
    expect(badgeRemovable(free)).toBe(false);
  });

  it("give Starter PDF and PNG only", () => {
    const starter = status("starter", { export_pdf: true, export_html: true, export_pptx: true });
    expect(deckExportAllowed(starter, "pdf")).toBe(true);
    expect(deckExportAllowed(starter, "png")).toBe(true);
    expect(deckExportAllowed(starter, "html")).toBe(false);
    expect(deckExportAllowed(starter, "pptx")).toBe(false);
  });

  it("follow the rights on Builder and above", () => {
    const builder = status("builder", { export_pdf: true, export_pptx: true });
    expect(deckExportAllowed(builder, "pptx")).toBe(true);
    expect(deckExportAllowed(builder, "html")).toBe(false);
  });
});

describe("export responses", () => {
  it("decode the warnings header, dropping junk", () => {
    const header = encode([{ code: "FONT_NOT_EMBEDDED", message: "Install Inter", font: "Inter", fallback: "Arial" }, { nope: 1 }]);
    expect(decodeWarnings(header)).toEqual([{ code: "FONT_NOT_EMBEDDED", message: "Install Inter", font: "Inter", fallback: "Arial" }]);
    expect(decodeWarnings("%%%")).toEqual([]);
    expect(decodeWarnings(null)).toEqual([]);
  });

  it("translate known warnings", () => {
    const w = { code: "FONT_NOT_EMBEDDED", message: "Install", font: "Inter", fallback: "Arial" };
    expect(warningText(w, "en")).toBe("Install");
    expect(warningText(w, "fr")).toContain("Inter");
    expect(warningText({ code: "OTHER", message: "x" }, "fr")).toBe("x");
  });

  it("name the file from Content-Disposition or the project", () => {
    expect(exportFilename('attachment; filename="Deck.pptx"', "x", "pptx")).toBe("Deck.pptx");
    expect(exportFilename(null, "Mon deck / 2026", "png")).toBe("Mon-deck-2026.zip");
    expect(presenterUrl("https://deck.forge.app/")).toBe("https://deck.forge.app/presenter/");
  });

  it("return the file and its warnings", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Blob(["%PDF"]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="Deck.pdf"', "X-Forge-Export-Warnings": encode([{ code: "A", message: "b" }]) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await exportDeck("p1", "pdf", { steps: true });
    expect(result.filename).toBe("Deck.pdf");
    expect(result.warnings).toEqual([{ code: "A", message: "b" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/projects\/p1\/exports\/pdf$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ steps: true });
  });

  it("flag an upgrade with the plan that unlocks the format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: { code: "EXPORT_NOT_IN_PLAN", message: "PPTX export is not included", requiredPlan: "builder" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const err = await exportDeck("p1", "pptx").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeckExportError);
    expect((err as DeckExportError).upgradeRequired).toBe(true);
    expect((err as DeckExportError).requiredPlan).toBe("builder");
    expect((err as DeckExportError).format).toBe("pptx");
  });
});
