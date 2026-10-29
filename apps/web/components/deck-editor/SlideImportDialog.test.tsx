import { describe, expect, it, vi } from "vitest";

import { DEFAULT_TOKENS } from "@/components/deck-player";
import type { Deck } from "@/lib/contracts/forge-design";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import type { ImportedSlide } from "./slide-import";
import { SlideImportDialog, type SlideImportState } from "./SlideImportDialog";
import { deckString } from "./strings";

const t = (key: Parameters<typeof deckString>[1], vars?: Record<string, string | number>) => deckString("fr", key, vars);

const deck: Deck = {
  version: 1,
  title: "Deck",
  format: { ratio: "16:9", width: 1920, height: 1080 },
  theme: { designSystem: "local", tokens: "design-system.json" },
  slides: [],
};

function imported(index: number, warnings: Record<string, number> = {}): ImportedSlide {
  return {
    index,
    title: `Titre ${index}`,
    hidden: index === 3,
    slide: { id: `imported-${index}`, background: { type: "color", token: "#102030" }, elements: [] },
    notes: "",
    warnings,
  };
}

function setup(state: SlideImportState) {
  const onImport = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(<SlideImportDialog state={state} deck={deck} tokens={DEFAULT_TOKENS} assetUrl={(p) => p} t={t} onCancel={onCancel} onImport={onImport} />);
  return { onImport, onCancel };
}

const ready = (slides: ImportedSlide[]): SlideImportState => ({ status: "ready", name: "deck.pptx", result: { canvas: { width: 1920, height: 1080 }, slides, warnings: {} } });

describe("SlideImportDialog", () => {
  it("selects every slide first and counts the selection", () => {
    setup(ready([imported(1), imported(2), imported(3)]));
    expect(screen.getByRole("dialog", { name: t("importTitle") })).toBeInTheDocument();
    expect(screen.getByText(t("importCount", { n: 3, total: 3 }))).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4); // 3 slides + keep theme
    expect(screen.getByText(t("importHidden"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: t("importSlideLabel", { n: 2, title: "Titre 2" }) }));
    expect(screen.getByText(t("importCount", { n: 2, total: 3 }))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("importClear") }));
    expect(screen.getByText(t("importCount", { n: 0, total: 3 }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("importRun") })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: t("selectAll") }));
    expect(screen.getByText(t("importCount", { n: 3, total: 3 }))).toBeInTheDocument();
  });

  it("hands back the picks in file order and the theme choice", () => {
    const { onImport } = setup(ready([imported(1), imported(2), imported(3)]));
    fireEvent.click(screen.getByRole("button", { name: t("importClear") }));
    fireEvent.click(screen.getByRole("checkbox", { name: t("importSlideLabel", { n: 3, title: "Titre 3" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: t("importSlideLabel", { n: 1, title: "Titre 1" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(t("importKeepTheme")) }));
    fireEvent.click(screen.getByRole("button", { name: t("importRun") }));
    expect(onImport).toHaveBeenCalledTimes(1);
    const [picks, keepTheme] = onImport.mock.calls[0];
    expect((picks as ImportedSlide[]).map((s) => s.index)).toEqual([1, 3]);
    expect(keepTheme).toBe(false);
  });

  it("lists the warnings of the picked slides only", () => {
    setup(ready([imported(1, { shape_approximated: 2 }), imported(2, { chart_placeholder: 1 })]));
    expect(screen.getByText(t("importWarn_shape_approximated", { n: 2 }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: t("importSlideLabel", { n: 2, title: "Titre 2" }) }));
    expect(screen.queryByText(t("importWarn_chart_placeholder", { n: 1 }))).not.toBeInTheDocument();
  });

  it("shows progress and errors, and cancels", () => {
    const { onCancel } = setup({ status: "reading", name: "deck.pptx" });
    expect(screen.getByRole("status")).toHaveTextContent(t("importReading", { name: "deck.pptx" }));
    expect(screen.getByRole("button", { name: t("importRun") })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: t("cancel") }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onCancel } = setup({ status: "error", name: "deck.pptx", message: t("importErrorEncrypted") });
    expect(screen.getByRole("alert")).toHaveTextContent(t("importErrorEncrypted"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
