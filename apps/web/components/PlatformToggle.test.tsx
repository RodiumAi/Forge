import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { PlatformToggle } from "@/components/PlatformToggle";
import { enabledKindsFrom, normalizeKind, resetEnabledKindsCache } from "@/lib/kinds";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

const rows = (on: string[]) =>
  ["web", "mobile", "slides", "codelab", "design_system"].map((id) => ({
    id,
    enabled: id === "web" || id === "mobile" || on.includes(id),
  }));

describe("project kinds", () => {
  beforeEach(() => {
    apiMock.mockReset();
    resetEnabledKindsCache();
  });

  it("normalizes unknown values to web", () => {
    expect(normalizeKind("mobile")).toBe("mobile");
    expect(normalizeKind(" Slides ")).toBe("slides");
    expect(normalizeKind("diagram")).toBe("web");
    expect(normalizeKind(null)).toBe("web");
  });

  it("keeps web and mobile even if the API forgets them", () => {
    expect(enabledKindsFrom([{ id: "codelab", enabled: true }, { id: "bogus", enabled: true }])).toEqual([
      "web",
      "mobile",
      "codelab",
    ]);
    expect(enabledKindsFrom("garbage")).toEqual(["web", "mobile"]);
  });

  it("shows web and mobile only while the document kinds are off", async () => {
    apiMock.mockResolvedValue(rows([]));
    renderWithProviders(<PlatformToggle value="web" onChange={() => {}} />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/kinds", expect.anything()));
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Web", "Appli"]);
  });

  it("adds a kind once its flag is on", async () => {
    apiMock.mockResolvedValue(rows(["slides"]));
    const onChange = vi.fn();
    const { user } = renderWithProviders(<PlatformToggle value="web" onChange={onChange} />);
    const slides = await screen.findByRole("button", { name: "Présentation" });
    await user.click(slides);
    expect(onChange).toHaveBeenCalledWith("slides");
  });

  it("falls back to web and mobile when the API fails", async () => {
    apiMock.mockRejectedValue(new Error("offline"));
    renderWithProviders(<PlatformToggle value="mobile" onChange={() => {}} />);
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Appli" })).toHaveAttribute("aria-pressed", "true");
  });
});
