import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test/render";
import type { Slide } from "@/lib/contracts/forge-design";
import { LayersPanel } from "./LayersPanel";
import type { Doc } from "./model";
import type { Recipe } from "./ops";
import { deckString } from "./strings";

const t = (key: Parameters<typeof deckString>[1]) => deckString("en", key);

const slide: Slide = {
  id: "s1",
  elements: [
    { id: "back", type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10, z: 0 },
    {
      id: "pair",
      type: "group",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      z: 1,
      children: [
        { id: "one", type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10 },
        { id: "two", type: "shape", shape: "rect", x: 10, y: 10, w: 10, h: 10 },
      ],
    },
    { id: "front", type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10, z: 2 },
  ],
} as Slide;

/** Applies a recipe to a one-slide doc and returns the slide. */
function apply(recipe: Recipe): Slide {
  const doc = { deck: { slides: [{ id: "s1" }] }, slides: { s1: slide } } as unknown as Doc;
  return recipe(doc).slides.s1;
}

function setup(selection: string[] = []) {
  const run = vi.fn();
  const onSelect = vi.fn();
  const view = renderWithProviders(<LayersPanel slide={slide} selection={selection} run={run} onSelect={onSelect} t={t} />);
  return { ...view, run, onSelect };
}

describe("LayersPanel", () => {
  it("lists the front first and unfolds a group", async () => {
    const { user, container } = setup();
    const ids = () => Array.from(container.querySelectorAll("[data-layer]")).map((el) => el.getAttribute("data-layer"));
    expect(ids()).toEqual(["front", "pair", "back"]);
    await user.click(screen.getByRole("button", { name: t("layerExpand") }));
    expect(ids()).toEqual(["front", "pair", "two", "one", "back"]);
  });

  it("picks a child inside its group, and Ctrl adds a sibling", async () => {
    const { user, onSelect } = setup(["two"]);
    // The group holding the selection opens by itself.
    await user.click(screen.getByRole("button", { name: "one" }));
    expect(onSelect).toHaveBeenLastCalledWith(["one"], "pair");
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("button", { name: "two" }));
    await user.keyboard("{/Control}");
    expect(onSelect).toHaveBeenLastCalledWith([], "pair");
  });

  it("hides and locks from the row", async () => {
    const { user, run } = setup();
    await user.click(screen.getAllByRole("button", { name: t("hide") })[0]);
    expect(apply(run.mock.calls[0][0]).elements.find((e) => e.id === "front")?.hidden).toBe(true);
    await user.click(screen.getAllByRole("button", { name: t("lock") })[0]);
    expect(apply(run.mock.calls[1][0]).elements.find((e) => e.id === "front")?.locked).toBe(true);
  });

  it("moves a layer with Alt+Arrow and renames with F2", async () => {
    const { user, run } = setup();
    screen.getByRole("button", { name: "back" }).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    const order = (s: Slide) => [...s.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((e) => e.id);
    expect(order(apply(run.mock.calls[0][0]))).toEqual(["pair", "back", "front"]);

    screen.getByRole("button", { name: "back" }).focus();
    await user.keyboard("{F2}");
    const field = screen.getByRole("textbox", { name: t("layerRename") });
    await user.clear(field);
    await user.type(field, "Fond{Enter}");
    expect(apply(run.mock.calls[1][0]).elements.find((e) => e.id === "back")?.name).toBe("Fond");
  });

  it("drops nothing when Escape cancels a rename", async () => {
    const { user, run } = setup();
    screen.getByRole("button", { name: "back" }).focus();
    await user.keyboard("{F2}");
    await user.type(screen.getByRole("textbox", { name: t("layerRename") }), "x{Escape}");
    expect(run).not.toHaveBeenCalled();
  });
});
