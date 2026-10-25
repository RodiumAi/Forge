import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test/render";
import { elementMenu, slideMenu } from "@/components/deck-editor/deck-menus";
import { deckString } from "@/components/deck-editor/strings";
import type { SlideElement } from "@/lib/contracts/forge-design";

import { ContextMenu, isContextMenuKey, type ContextMenuEntry } from "./ContextMenu";

const t = (key: Parameters<typeof deckString>[1]) => deckString("en", key);

function noop() {}

describe("ContextMenu", () => {
  const items = (onCopy: () => void): ContextMenuEntry[] => [
    { id: "copy", label: "Copy", shortcut: "Ctrl+C", onSelect: onCopy },
    { id: "off", label: "Paste", disabled: true, onSelect: noop },
    { type: "separator" },
    {
      type: "submenu",
      id: "arrange",
      label: "Arrange",
      items: [{ id: "front", label: "Bring to front", onSelect: noop }],
    },
  ];

  it("lists the rows, runs one on click and closes", async () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    const { user } = renderWithProviders(<ContextMenu request={{ x: 10, y: 10, items: items(onCopy), label: "Actions" }} onClose={onClose} />);
    expect(screen.getByRole("menu", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Paste/ })).toHaveAttribute("aria-disabled", "true");
    // A finger lifted right after a long press must not pick a row: wait past the guard.
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole("menuitem", { name: /Copy/ }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<ContextMenu request={{ x: 10, y: 10, items: items(noop) }} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("knows the keys that ask for a menu", () => {
    expect(isContextMenuKey({ key: "ContextMenu", shiftKey: false })).toBe(true);
    expect(isContextMenuKey({ key: "F10", shiftKey: true })).toBe(true);
    expect(isContextMenuKey({ key: "F10", shiftKey: false })).toBe(false);
  });
});

describe("deck menus", () => {
  const actions = new Proxy({}, { get: () => noop }) as never;
  const image = { id: "img", type: "image", src: "assets/a.png", x: 0, y: 0, w: 10, h: 10 } as SlideElement;

  const ids = (entries: ContextMenuEntry[]): string[] => entries.flatMap((e) => ("id" in e ? [e.id] : []));

  it("offers the image rows on an image, and locks out what would move it", () => {
    const rows = elementMenu({ t, readOnly: false, single: image, count: 1, anyLocked: false, allLocked: false, canPaste: true, aiReady: true, rotation: 0, do: actions });
    expect(ids(rows)).toEqual(expect.arrayContaining(["replace", "fit", "ratio", "alt", "arrange", "rotation", "lock", "delete"]));
    const locked = elementMenu({ t, readOnly: false, single: { ...image, locked: true }, count: 1, anyLocked: true, allLocked: true, canPaste: true, aiReady: true, rotation: 0, do: actions });
    const del = locked.find((e) => "id" in e && e.id === "delete");
    expect(del && "disabled" in del && del.disabled).toBe(true);
    expect(ids(locked)).toContain("unlock");
  });

  it("keeps only copy usable in read-only mode", () => {
    const rows = elementMenu({ t, readOnly: true, single: image, count: 1, anyLocked: false, allLocked: false, canPaste: true, aiReady: true, rotation: 0, do: actions });
    const enabled = rows.filter((e) => "id" in e && !e.disabled).map((e) => ("id" in e ? e.id : ""));
    expect(enabled).toEqual(["copy"]);
  });

  it("disables moving the first slide up", () => {
    const rows = slideMenu({ t, readOnly: false, index: 0, total: 3, hidden: false, aiReady: true, do: actions });
    const up = rows.find((e) => "id" in e && e.id === "up");
    expect(up && "disabled" in up && up.disabled).toBe(true);
  });
});
