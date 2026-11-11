/**
 * Design system editor: "Delete design system" sits in the project menu of the
 * top bar, for the owner only; confirming calls `DELETE /projects/{id}` then
 * goes back to the design systems tab of the dashboard.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/render";
import type { DesignSystemItem } from "./api";
import type { DesignSystemDoc } from "./tokens";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const net = vi.hoisted(() => ({ api: vi.fn(), item: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api", () => ({ api: net.api, getToken: () => "token", ApiError: class ApiError extends Error {} }));
vi.mock("./api", () => ({
  loadDocument: async () => ({ doc: kit(), etag: "e1" }),
  saveDocument: vi.fn(),
  uploadLogo: vi.fn(),
  downloadExport: vi.fn(),
  assetObjectUrl: async () => null,
  errorCode: () => undefined,
  getDesignSystemItem: net.item,
}));
vi.mock("./DesignSystemChat", () => ({ DesignSystemChat: () => null }));
vi.mock("./DesignSystemShareHub", () => ({ DesignSystemShareHub: () => null }));
vi.mock("./DesignSystemPreview", () => ({ DesignSystemPreview: () => null }));
vi.mock("@/components/builder/ShareButton", () => ({ ShareButton: () => null }));

import { DesignSystemEditor } from "./DesignSystemEditor";

function kit(): DesignSystemDoc {
  const file = path.join(process.cwd(), "..", "..", "data", "templates", "design-system-saas", "design-system.json");
  return JSON.parse(readFileSync(file, "utf8")) as DesignSystemDoc;
}

function item(mine: boolean): Partial<DesignSystemItem> {
  return { id: "ds1", name: kit().name, owner: { id: "u1", name: null, mine }, can_edit: true, can_share: mine };
}

beforeEach(() => {
  nav.replace.mockReset();
  net.api.mockReset();
  net.item.mockReset();
});

describe("DesignSystemEditor, delete project", () => {
  it("lets the owner delete it, then goes back to the design systems", async () => {
    net.item.mockResolvedValue(item(true));
    net.api.mockResolvedValue(null);
    const name = kit().name;
    renderWithProviders(<DesignSystemEditor projectId="ds1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Supprimer le design system/ }));

    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText(`Tapez « ${name} » pour confirmer`), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le projet" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard?tab=design_systems"));
    expect(net.api).toHaveBeenCalledWith("/projects/ds1", { method: "DELETE" });
    expect(net.api.mock.invocationCallOrder[0]).toBeLessThan(nav.replace.mock.invocationCallOrder[0]);
  }, 20_000);

  it("shows no project menu to someone who does not own it", async () => {
    net.item.mockResolvedValue(item(false));
    renderWithProviders(<DesignSystemEditor projectId="ds1" />);
    await screen.findByRole("navigation");
    await waitFor(() => expect(net.item).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Options" })).toBeNull();
    expect(screen.queryByText(/Supprimer le design system/)).toBeNull();
  }, 20_000);
});
