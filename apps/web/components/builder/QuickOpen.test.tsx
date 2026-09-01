import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { QuickOpen } from "./QuickOpen";

const FILES = [
  "src/App.tsx",
  "src/components/Button.tsx",
  "src/components/ui/Card.tsx",
  "src/pages/Home.tsx",
  "public/logo.png",
  "index.html",
];

function setup(props: Partial<React.ComponentProps<typeof QuickOpen>> = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const utils = renderWithProviders(
    <QuickOpen open files={FILES} onPick={onPick} onClose={onClose} {...props} />,
  );
  return { ...utils, onPick, onClose };
}

const options = () => screen.queryAllByRole("option");
const activeOption = () => options().find((o) => o.getAttribute("aria-selected") === "true");

describe("visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the files when open", () => {
    setup();
    expect(options()).toHaveLength(FILES.length);
  });
});

describe("filtering", () => {
  it("matches on the filename", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "Button");
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveTextContent("Button.tsx");
  });

  it("matches a subsequence spread across the path", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "scard");
    expect(options()[0]).toHaveTextContent("Card.tsx");
  });

  it("is case insensitive", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "APP");
    expect(options()[0]).toHaveTextContent("App.tsx");
  });

  it("ranks a filename match above a path-only match", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "home");
    expect(options()[0]).toHaveTextContent("Home.tsx");
  });

  it("shows an empty state when nothing matches", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "zzzzz");
    expect(options()).toHaveLength(0);
    expect(screen.getByText(/aucun fichier/i)).toBeInTheDocument();
  });

  it("separates the filename from its directory", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "Button");
    const option = options()[0];
    expect(within(option).getByText("Button.tsx")).toBeInTheDocument();
    expect(within(option).getByText("src/components")).toBeInTheDocument();
  });
});

describe("keyboard", () => {
  it("selects the first result by default", () => {
    setup();
    expect(activeOption()).toHaveTextContent("App.tsx");
  });

  it("moves down and up the list", async () => {
    const { user } = setup();
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Button.tsx");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toHaveTextContent("App.tsx");
  });

  it("wraps around at both ends", async () => {
    const { user } = setup();
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toHaveTextContent("index.html");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("App.tsx");
  });

  it("opens the highlighted file on Enter", async () => {
    const { user, onPick } = setup();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith("src/components/Button.tsx");
  });

  it("closes on Escape", async () => {
    const { user, onClose } = setup();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("resets the highlight when the query changes", async () => {
    const { user } = setup();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.type(screen.getByRole("combobox"), "s");
    expect(activeOption()).toBe(options()[0]);
  });

  it("does nothing on Enter with no results", async () => {
    const { user, onPick } = setup();
    await user.type(screen.getByRole("combobox"), "zzzzz");
    await user.keyboard("{Enter}");
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("mouse", () => {
  it("opens the clicked file", async () => {
    const { user, onPick } = setup();
    await user.click(screen.getByText("Card.tsx"));
    expect(onPick).toHaveBeenCalledWith("src/components/ui/Card.tsx");
  });

  it("closes when the backdrop is clicked", async () => {
    const { user, onClose, container } = setup();
    await user.click(container.querySelector(".quick-open-backdrop")!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("accessibility", () => {
  it("wires the combobox to its listbox", () => {
    setup();
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "quick-open-list");
    expect(screen.getByRole("listbox")).toHaveAttribute("id", "quick-open-list");
  });

  it("is announced as a modal dialog", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("focuses the input on open", async () => {
    setup();
    expect(await screen.findByRole("combobox")).toHaveFocus();
  });
});
