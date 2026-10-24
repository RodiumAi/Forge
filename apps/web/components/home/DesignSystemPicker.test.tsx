import { describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

import { DesignSystemPicker, previewFromDocument } from "@/components/home/DesignSystemPicker";
import { renderWithProviders, screen, within } from "@/test/render";

const DOC = {
  version: 1,
  name: "Marque",
  tokens: {
    color: { $type: "color", bg: { $value: "#1c1f26" }, accent: { $value: "#eb6118" } },
    font: { $type: "fontFamily", display: { $value: ["Open Sauce Sans", "sans-serif"] }, body: { $value: ["Inter"] } },
  },
};

describe("DesignSystemPicker", () => {
  it("reads colours and fonts for the mini preview", () => {
    expect(previewFromDocument(DOC)).toEqual({
      colors: ["#1c1f26", "#eb6118"],
      display: "Open Sauce Sans",
      body: "Inter",
    });
    expect(previewFromDocument(null)).toEqual({ colors: [], display: null, body: null });
  });

  it("offers None plus each design system and reports the choice", async () => {
    apiMock.mockResolvedValue(DOC);
    const onChange = vi.fn();
    const { user, rerender } = renderWithProviders(
      <DesignSystemPicker options={[{ id: "ds-1", name: "Marque" }]} value={null} onChange={onChange} />,
    );
    const button = screen.getByRole("button", { name: /Design system du nouveau projet: Aucun/ });
    await user.click(button);
    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.textContent?.split(/Titres/)[0])).toEqual(["Aucun", "Marque"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(await within(list).findByText(/Titres: Open Sauce Sans/)).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("ds-1");
    expect(apiMock).toHaveBeenCalledWith("/projects/ds-1/design-system", { retries: 0 });

    rerender(<DesignSystemPicker options={[{ id: "ds-1", name: "Marque" }]} value="ds-1" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Marque/ }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Aucun" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
