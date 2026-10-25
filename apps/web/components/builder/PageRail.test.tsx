import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { PageRail, pageThumbs } from "./PageRail";

const PAGES = ["/", "/carte", "/contact"];

function mount(over: Partial<Parameters<typeof PageRail>[0]> = {}) {
  const props = {
    projectId: "p-rail",
    pages: PAGES,
    currentPath: "/",
    mobile: false,
    selected: [] as string[],
    onSelectedChange: vi.fn(),
    onNavigate: vi.fn(),
    placement: "left" as const,
    onPlacementChange: vi.fn(),
    collapsed: false,
    onCollapsedChange: vi.fn(),
    ...over,
  };
  const { user } = renderWithProviders(<PageRail {...props} />);
  return { props, user };
}

describe("PageRail", () => {
  it("lists every page with its count and marks the current one", () => {
    mount({ currentPath: "/carte" });
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "carte (/carte)" })).toHaveAttribute("aria-current", "page");
    // Never opened: a placeholder with the page name.
    expect(screen.getByRole("button", { name: "Accueil (/)" })).toHaveTextContent("Accueil");
  });

  it("navigates on click and selects with Ctrl or Shift click", async () => {
    const { props, user } = mount();
    await user.click(screen.getByRole("button", { name: "contact (/contact)" }));
    expect(props.onNavigate).toHaveBeenCalledWith("/contact");

    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("button", { name: "carte (/carte)" }));
    await user.keyboard("{/Control}");
    expect(props.onSelectedChange).toHaveBeenLastCalledWith(["/carte"]);
    expect(props.onNavigate).toHaveBeenCalledTimes(1);
  });

  it("shows a snapshot once one is cached", () => {
    pageThumbs.set("p-rail", "/carte", `data:image/webp;base64,${"A".repeat(2000)}`);
    const { container } = renderWithProviders(
      <PageRail
        projectId="p-rail"
        pages={PAGES}
        currentPath="/"
        mobile={false}
        selected={[]}
        onSelectedChange={() => {}}
        onNavigate={() => {}}
        placement="bottom"
        onPlacementChange={() => {}}
        collapsed={false}
        onCollapsedChange={() => {}}
      />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("toggles placement and collapses to a reopen tab", async () => {
    const { props, user } = mount();
    await user.click(screen.getByRole("button", { name: /sous l'aperçu/i }));
    expect(props.onPlacementChange).toHaveBeenCalledWith("bottom");
    await user.click(screen.getByRole("button", { name: /masquer les pages/i }));
    expect(props.onCollapsedChange).toHaveBeenCalledWith(true);
  });
});
