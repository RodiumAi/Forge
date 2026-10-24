import { describe, expect, it, vi } from "vitest";

import { KindGrid } from "@/components/home/KindGrid";
import { renderWithProviders, screen, within } from "@/test/render";

describe("KindGrid", () => {
  it("shows only the tiles of enabled kinds", () => {
    renderWithProviders(<KindGrid enabledKinds={["web", "mobile"]} selected="blank" onSelect={vi.fn()} />);
    const main = screen.getByRole("list", { name: "Choisir un type" });
    expect(within(main).getAllByRole("button").map((b) => b.getAttribute("data-tile"))).toEqual([
      "blank",
      "web",
      "mobile",
    ]);
    const shortcuts = screen.getByRole("list", { name: "Raccourcis" });
    expect(within(shortcuts).getAllByRole("button").map((b) => b.getAttribute("data-tile"))).toEqual([
      "landing_page",
    ]);
    expect(screen.queryByRole("button", { name: /Présentation/ })).toBeNull();
  });

  it("shows every type and shortcut once the document kinds are on", () => {
    renderWithProviders(
      <KindGrid
        enabledKinds={["web", "mobile", "slides", "codelab", "design_system"]}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    for (const name of [
      /Vierge/,
      /Site web/,
      /Appli mobile/,
      /^Présentation$/,
      /^Codelab$/,
      /^Design system$/,
      /Pitch deck/,
      /Carrousel réseaux sociaux/,
      /Landing page/,
      /Tutoriel/,
      /Palette et polices/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("reports the clicked tile and marks the selected one", async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(
      <KindGrid enabledKinds={["web", "mobile", "slides"]} selected="slides" onSelect={onSelect} />,
    );
    expect(screen.getByRole("button", { name: /^Présentation$/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Carrousel/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "social_carousel", kind: "slides", format: "1:1" }));
  });

  it("collapses and remembers it", async () => {
    const { user, unmount } = renderWithProviders(
      <KindGrid enabledKinds={["web", "mobile"]} selected={null} onSelect={vi.fn()} />,
    );
    const toggle = screen.getByRole("button", { name: /Choisir un type/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Site web/ })).toBeNull();
    unmount();
    renderWithProviders(<KindGrid enabledKinds={["web", "mobile"]} selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /Choisir un type/ })).toHaveAttribute("aria-expanded", "false");
  });
});
