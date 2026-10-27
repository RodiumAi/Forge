import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { AUTOSAVE_DELAY_MS } from "./autosave";
import type { ChatClient } from "./chat-client";
import { DeckEditor } from "./DeckEditor";
import { MemoryDocServer } from "./memory-transport";
import type { DeckPublisher } from "./PublishMenu";
import { deckString } from "./strings";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const t = (key: Parameters<typeof deckString>[1], vars?: Record<string, string | number>) => deckString("fr", key, vars);

const deck: Deck = {
  version: 1,
  title: "Test deck",
  format: { ratio: "16:9", width: 1920, height: 1080 },
  theme: { designSystem: "local", tokens: "DESIGN.md" },
  slides: [
    { id: "s1", layout: "title" },
    { id: "s2", layout: "text" },
  ],
};

const slides: Record<string, Slide> = {
  s1: {
    id: "s1",
    elements: [
      { id: "title", type: "text", role: "title", x: 100, y: 100, w: 800, h: 200, content: [{ type: "paragraph", text: "Bonjour" }] },
      { id: "box", type: "shape", shape: "rect", x: 1000, y: 500, w: 200, h: 100, fill: "--accent" },
    ],
  },
  s2: { id: "s2", elements: [] },
};

function setup(chat: ChatClient | null = null, publisher: DeckPublisher | null = null) {
  localStorage.setItem("forge_locale", "fr");
  const server = new MemoryDocServer(deck, slides, { s1: "Notes 1" });
  render(
    <I18nProvider>
      <DeckEditor
        projectId="p1"
        transport={server.transport()}
        loadTheme={async () => "--accent: #ff0000"}
        assetUrl={(p) => p}
        chat={chat}
        images={null}
        badgeRemovable={false}
        publisher={publisher}
        backHref="/dashboard"
      />
    </I18nProvider>,
  );
  return server;
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

afterEach(() => {
  vi.useRealTimers();
});

/** Opens the Layers tab and clicks a row. */
function pickLayer(name: string) {
  fireEvent.click(screen.getByRole("tab", { name: t("tabLayers") }));
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("DeckEditor", () => {
  it("loads the deck and shows its slides and notes", async () => {
    setup();
    expect(await screen.findByText("Test deck")).toBeInTheDocument();
    const rail = screen.getByRole("navigation", { name: t("slides") });
    expect(within(rail).getAllByRole("button", { name: /Slide \d/ })).toHaveLength(2);
    expect(await screen.findByDisplayValue("Notes 1")).toBeInTheDocument();
  });

  it("selects from the layers, nudges with the keyboard, undoes, and autosaves the slide", async () => {
    const server = setup();
    await screen.findByText("Test deck");
    pickLayer("box");
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await wait(AUTOSAVE_DELAY_MS + 200);
    const saved = () => server.slides.get("s1")!.value.elements.find((e) => e.id === "box")!;
    expect(saved()).toMatchObject({ x: 1010, y: 501 });
    expect(server.writes).toEqual(["slide:s1"]);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await wait(AUTOSAVE_DELAY_MS + 200);
    expect(saved()).toMatchObject({ x: 1000, y: 500 });
  });

  it("deletes the selection with the Delete key", async () => {
    const server = setup();
    await screen.findByText("Test deck");
    pickLayer("box");
    fireEvent.keyDown(window, { key: "Delete" });
    await wait(AUTOSAVE_DELAY_MS + 200);
    expect(server.slides.get("s1")!.value.elements.map((e) => e.id)).toEqual(["title"]);
  });

  it("adds a slide from the layout picker after the current one", async () => {
    const server = setup();
    await screen.findByText("Test deck");
    fireEvent.click(screen.getByRole("button", { name: t("addSlide") }));
    const picker = screen.getByRole("dialog", { name: t("chooseLayout") });
    expect(within(picker).getAllByRole("button")).toHaveLength(13);
    fireEvent.click(within(picker).getByText(t("layoutQuote")));
    await wait(AUTOSAVE_DELAY_MS + 200);
    const ids = server.deck.value.slides.map((r) => r.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("s1");
    expect(server.deck.value.slides[1].layout).toBe("quote");
    expect(server.writes.slice(0, 2)).toEqual(["deck", `slide:${ids[1]}`]);
    expect(server.slides.get(ids[1])!.value.elements.map((e) => e.id)).toEqual(["quote", "caption"]);
  });

  it("applies AI events to one slide and keeps unsaved edits of another", async () => {
    let emit: ((p: Record<string, unknown>) => void) | null = null;
    let finish: () => void = () => undefined;
    const chat: ChatClient = {
      messages: async () => [],
      active: async () => null,
      send: (_body, onEvent) =>
        new Promise<void>((resolve) => {
          emit = onEvent;
          finish = resolve;
        }),
      confirm: async () => undefined,
      subscribe: async () => undefined,
      cancel: async () => undefined,
    };
    const server = setup(chat);
    await screen.findByText("Test deck");
    // A local edit on s1, not yet saved.
    pickLayer("box");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    // The AI rewrites s2 meanwhile.
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Remplis la slide 2" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(emit).not.toBeNull());
    const aiSlide: Slide = { id: "s2", elements: [{ id: "t", type: "text", x: 0, y: 0, w: 100, h: 100, content: [{ type: "paragraph", text: "IA" }] }] };
    server.externalSlide(aiSlide);
    await act(async () => {
      emit!({ type: "deck.slide", run_id: "r", slide_id: "s2", slide: aiSlide, notes: "Dites bonjour", fallback: true });
      emit!({ type: "warning", message: "SLIDE_FALLBACK: s2", violation: { code: "SLIDE_FALLBACK", path: "slides/s2.json" } });
      emit!({ type: "done", summary: "ok" });
      finish();
    });
    await wait(AUTOSAVE_DELAY_MS + 200);
    // s1 keeps the local edit and saves it; s2 is not written back by the editor.
    expect(server.slides.get("s1")!.value.elements.find((e) => e.id === "box")).toMatchObject({ x: 999 });
    expect(server.writes.filter((w) => w === "slide:s2")).toHaveLength(0);
    // The fallback notice marks slide 2 in the rail.
    fireEvent.click(screen.getByRole("button", { name: "Slide 2" }));
    expect(await screen.findByText(t("noticeFallback"))).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dites bonjour")).toBeInTheDocument();
  });

  it("saves pending edits, then publishes with notes and the badge kept on a plan that cannot remove it", async () => {
    const calls: unknown[] = [];
    const ref: { server?: MemoryDocServer } = {};
    const publisher: DeckPublisher = {
      badgeRemovable: false,
      publish: async (options) => {
        calls.push({ options, saved: ref.server!.slides.get("s1")!.value.elements.find((e) => e.id === "box") });
        return { public_url: "https://deck.example/" };
      },
      presenterUrl: (url) => `${url}presenter/`,
    };
    ref.server = setup(null, publisher);
    await screen.findByText("Test deck");
    pickLayer("box");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: t("publish") }));
    const dialog = screen.getByRole("dialog", { name: t("publishTitle") });
    const badge = within(dialog).getByRole("checkbox", { name: t("publishBadge") });
    expect(badge).toBeChecked();
    expect(badge).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: t("publishNotes") }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: t("publishRun") }));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ options: { notes: true, badge: true }, saved: { x: 1001 } });
    expect(await within(dialog).findByRole("link", { name: t("publishPresenter") })).toHaveAttribute("href", "https://deck.example/presenter/");
  });
});
