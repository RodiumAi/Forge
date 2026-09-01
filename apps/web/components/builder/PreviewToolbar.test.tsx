import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { PreviewToolbar } from "./PreviewToolbar";

function mount(tool: "select" | null = null) {
  const onToolChange = vi.fn();
  const { user } = renderWithProviders(
    <PreviewToolbar tool={tool} onToolChange={onToolChange} />,
  );
  return { onToolChange, user };
}

describe("PreviewToolbar collapsing", () => {
  it("is visible by default", () => {
    mount();
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.queryByLabelText(/afficher la barre/i)).toBeNull();
  });

  it("collapses to a single restore pill", async () => {
    const { user } = mount();
    await user.click(screen.getByLabelText(/masquer la barre/i));
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.getByLabelText(/afficher la barre/i)).toBeInTheDocument();
  });

  it("clears the active tool when hiding", async () => {
    // An active tool behind an invisible toolbar would keep intercepting
    // clicks on the preview with no way to tell why.
    const { onToolChange, user } = mount("select");
    await user.click(screen.getByLabelText(/masquer la barre/i));
    expect(onToolChange).toHaveBeenCalledWith(null);
  });

  it("restores the full toolbar", async () => {
    const { user } = mount();
    await user.click(screen.getByLabelText(/masquer la barre/i));
    await user.click(screen.getByLabelText(/afficher la barre/i));
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText(/masquer la barre/i)).toBeInTheDocument();
  });
});
