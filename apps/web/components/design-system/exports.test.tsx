import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ForgeEntitlements, ForgeStatus } from "@/lib/forge-status";
import { renderWithProviders, screen } from "@/test/render";

import { designSystemExportAllowed, designSystemExportOptions } from "./exports";

let currentStatus: ForgeStatus | null = null;

vi.mock("@/lib/forge-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/forge-status")>();
  return { ...actual, useForgeStatus: () => currentStatus };
});

vi.mock("./api", () => ({
  loadDocument: vi.fn(async () => ({
    doc: JSON.parse(
      readFileSync(path.join(process.cwd(), "..", "..", "data", "templates", "design-system-saas", "design-system.json"), "utf8"),
    ),
    etag: "1",
  })),
  getDesignSystemItem: vi.fn(async () => {
    throw new Error("offline");
  }),
  downloadExport: vi.fn(async () => {}),
  errorCode: () => undefined,
  publish: vi.fn(),
  saveDocument: vi.fn(),
  setDefault: vi.fn(),
  share: vi.fn(),
  unshare: vi.fn(),
  uploadLogo: vi.fn(),
  assetObjectUrl: vi.fn(async () => null),
}));

vi.mock("./DesignSystemChat", async () => {
  const React = await import("react");
  return { DesignSystemChat: React.forwardRef(function DesignSystemChatStub() {
    return null;
  }) };
});

function status(plan: string, ent: Partial<ForgeEntitlements> = {}): ForgeStatus {
  return {
    frodi: 10,
    rodi: 0,
    plan,
    entitlements: {
      plan_slug: plan,
      status: "active",
      max_projects: null,
      model_selection: true,
      custom_domain: false,
      export_enabled: true,
      history_enabled: true,
      priority_generation: false,
      allowed_model_tiers: null,
      frodi_balance: 10,
      ...ent,
    },
  };
}

describe("design system export gating", () => {
  it("offers exactly PDF and Markdown", () => {
    expect(designSystemExportOptions(null).map((o) => o.format)).toEqual(["pdf", "md"]);
  });

  it("follows the plan rank", () => {
    expect(designSystemExportAllowed(null, "pdf")).toBe(true);
    expect(designSystemExportAllowed(status("free", { export_pdf: true }), "pdf")).toBe(false);
    expect(designSystemExportAllowed(status("free"), "md")).toBe(false);
    expect(designSystemExportAllowed(status("starter", { export_pdf: true }), "pdf")).toBe(true);
    // A higher plan includes the lower plans' formats even without the flag.
    expect(designSystemExportAllowed(status("pro"), "pdf")).toBe(true);
    expect(designSystemExportAllowed(status("team-scale"), "md")).toBe(true);
  });
});

describe("design system share panel downloads", () => {
  beforeEach(() => {
    currentStatus = null;
  });

  async function openDownloads() {
    const { DesignSystemEditor } = await import("./DesignSystemEditor");
    const view = renderWithProviders(<DesignSystemEditor projectId="p-1" />);
    await view.user.click(await screen.findByRole("button", { name: /Partager/ }));
    await view.user.click(await screen.findByRole("button", { name: /Télécharger/ }));
    return view;
  }

  it("shows the two formats, unlocked on a paid plan", async () => {
    currentStatus = status("builder", { export_pdf: true });
    await openDownloads();
    expect(screen.getByRole("button", { name: /Charte graphique \(PDF\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Charte graphique \(Markdown\)/ })).toBeTruthy();
    expect(screen.queryByText("Disponible dès le plan Starter")).toBeNull();
  });

  it("locks both with a hint on Free", async () => {
    currentStatus = status("free");
    const { user } = await openDownloads();
    expect(screen.getAllByText("Disponible dès le plan Starter")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Voir les offres" })).toBeTruthy();
    const { downloadExport } = await import("./api");
    await user.click(screen.getByRole("button", { name: /Charte graphique \(PDF\)/ }));
    expect(downloadExport).not.toHaveBeenCalled();
  });
});
