import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ForgeStatus } from "@/lib/forge-status";
import { ExportMenu } from "./ExportMenu";

function status(plan: string, rights: Record<string, boolean>): ForgeStatus {
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

afterEach(() => vi.unstubAllGlobals());

function renderMenu(props: Partial<Parameters<typeof ExportMenu>[0]> = {}) {
  return render(
    <I18nProvider>
      <ExportMenu projectId="p1" projectName="Deck" {...props} />
    </I18nProvider>,
  );
}

describe("ExportMenu", () => {
  it("locks the formats the plan lacks and asks for an upgrade instead", () => {
    const onUpgrade = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderMenu({ status: status("starter", { export_pdf: true }), onUpgrade });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const pptx = document.querySelector('[data-format="pptx"]') as HTMLButtonElement;
    expect(pptx.hasAttribute("data-locked")).toBe(true);
    expect(document.querySelector('[data-format="pdf"]')?.hasAttribute("data-locked")).toBe(false);
    fireEvent.click(pptx);
    expect(onUpgrade).toHaveBeenCalledWith("builder", "pptx");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads an allowed format and lists the warnings", async () => {
    const encoded = btoa(JSON.stringify([{ code: "X", message: "Heads up" }])).replace(/=+$/, "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["PK"]), { status: 200, headers: { "X-Forge-Export-Warnings": encoded } })),
    );
    const createObjectURL = vi.fn(() => "blob:x");
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    // jsdom cannot navigate: the download link click is a no-op here.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const onExported = vi.fn();
    renderMenu({ status: null, onExported });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(document.querySelector('[data-format="png"]') as HTMLButtonElement);
    await waitFor(() => expect(onExported).toHaveBeenCalledWith("png", [{ code: "X", message: "Heads up" }]));
    expect(createObjectURL).toHaveBeenCalled();
    expect(document.querySelector("[data-export-warnings]")?.textContent).toContain("Heads up");
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });
});
