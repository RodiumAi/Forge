/**
 * Deck editor route: "Delete project" is offered to the owner only, asks for
 * the project name, calls `DELETE /projects/{id}` then goes to the dashboard.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const net = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}));

vi.mock("@/lib/api", () => ({
  api: net.api,
  getToken: () => "token",
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/forge-status", () => ({ useForgeStatus: () => null }));
vi.mock("@/lib/media-token", () => ({ useMediaToken: () => null }));
vi.mock("@/components/builder/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/deck-exports/ExportMenu", () => ({ ExportMenu: () => null }));

// The editor itself is covered by DeckEditor.test.tsx; here only its project menu row matters.
vi.mock("@/components/deck-editor/DeckEditor", () => ({
  DeckEditor: ({ onDeleteProject }: { onDeleteProject?: () => void }) => (
    <div data-testid="deck-editor">
      {onDeleteProject ? (
        <button type="button" onClick={onDeleteProject}>
          delete-project
        </button>
      ) : null}
    </div>
  ),
}));

import DeckEditorPage from "./page";

function project(role: string) {
  return { id: "p1", name: "Mon deck", platform: "slides", access_role: role };
}

beforeEach(() => {
  nav.replace.mockReset();
  net.api.mockReset();
});

describe("deck page, delete project", () => {
  it("is offered to the owner, deletes then goes to the dashboard", async () => {
    net.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return null;
      if (path === "/projects/p1") return project("owner");
      throw new Error(`unexpected ${path}`);
    });
    renderWithProviders(<DeckEditorPage />);
    fireEvent.click(await screen.findByRole("button", { name: "delete-project" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = screen.getByRole("button", { name: "Supprimer le projet" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tapez « Mon deck » pour confirmer"), { target: { value: "Mon deck" } });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(confirm);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
    expect(net.api).toHaveBeenCalledWith("/projects/p1", { method: "DELETE" });
    const deleteCall = net.api.mock.invocationCallOrder[net.api.mock.calls.findIndex((c) => c[1]?.method === "DELETE")];
    expect(deleteCall).toBeLessThan(nav.replace.mock.invocationCallOrder[0]);
  });

  it.each(["editor", "viewer"])("is hidden from a %s", async (role) => {
    net.api.mockResolvedValue(project(role));
    renderWithProviders(<DeckEditorPage />);
    expect(await screen.findByTestId("deck-editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "delete-project" })).toBeNull();
  });
});
