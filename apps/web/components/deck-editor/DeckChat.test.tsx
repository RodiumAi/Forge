import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { MessageBody } from "./ai";
import type { ChatClient, StreamHandler } from "./chat-client";
import { DeckChat, type DeckChatProps } from "./DeckChat";
import { deckString } from "./strings";

// The file readers have their own tests (document-import.test.ts): here a
// PowerPoint reads as one slide, a PDF as one line.
vi.mock("./document-import", async (original) => {
  const actual = await original<typeof import("./document-import")>();
  return {
    ...actual,
    extractDocument: vi.fn(async (_file: File, kind: "pdf" | "pptx") =>
      kind === "pptx"
        ? { text: "--- Slide 1 ---\nTitle: Bilan 2026", truncated: false, slides: 1 }
        : { text: "Chiffres du rapport", truncated: false },
    ),
  };
});

const t = (key: Parameters<typeof deckString>[1], vars?: Record<string, string | number>) => deckString("fr", key, vars);

function client(overrides: Partial<ChatClient> = {}) {
  const sent: MessageBody[] = [];
  const confirmed: unknown[] = [];
  const c: ChatClient = {
    messages: async () => [],
    active: async () => null,
    send: vi.fn(async (body: MessageBody, onEvent: StreamHandler) => {
      sent.push(body);
      onEvent({ type: "done", summary: "OK" });
    }),
    confirm: vi.fn(async (_run: string, plan: unknown, onEvent: StreamHandler) => {
      confirmed.push(plan);
      onEvent({ type: "done", summary: "Écrit" });
    }),
    subscribe: async () => undefined,
    cancel: async () => undefined,
    ...overrides,
  };
  return { c, sent, confirmed };
}

function renderChat(props: Partial<DeckChatProps> & { client: ChatClient }) {
  const onEvent = vi.fn();
  const onNotice = vi.fn();
  localStorage.setItem("forge_locale", "fr");
  render(
    <I18nProvider>
      <DeckChat
        target={undefined}
        targetLabel={t("targetDeck")}
        actionTarget={{ slideId: "s1" }}
        onClearTarget={vi.fn()}
        onEvent={onEvent}
        onNotice={onNotice}
        beforeSend={async () => undefined}
        t={t}
        locale="fr"
        {...props}
      />
    </I18nProvider>,
  );
  return { onEvent, onNotice };
}

describe("DeckChat", () => {
  it("sends a deck-wide message without a target", async () => {
    const { c, sent } = client();
    renderChat({ client: c });
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Un pitch de 6 slides" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ content: "Un pitch de 6 slides", mode: "agent" });
    expect(await screen.findByText("OK")).toBeInTheDocument();
  });

  it("sends the selected element as target", async () => {
    const { c, sent } = client();
    renderChat({ client: c, target: { slideId: "s2", elementId: "body" }, targetLabel: "Slide 2, body" });
    expect(screen.getByTestId("deck-target")).toHaveTextContent("Slide 2, body");
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Plus court" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent[0]).toEqual({ content: "Plus court", mode: "agent", target: { slideId: "s2", elementId: "body" } }));
  });

  it("shows the target on the sent message, not on deck-wide ones", async () => {
    const { c } = client();
    renderChat({ client: c, target: { slideId: "s6" }, targetLabel: "Slide 6" });
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Plus visuel" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    const bubble = (await screen.findByText("Plus visuel")).closest(".de-msg-user");
    expect(bubble?.querySelector(".de-msg-tag")).toHaveTextContent("Slide 6");
  });

  it("sends quick actions with the label as content, on the current slide when nothing is selected", async () => {
    const { c, sent } = client();
    renderChat({ client: c });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("qaPunchier")) }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ content: t("qaPunchier"), mode: "agent", target: { slideId: "s1" }, action: "punchier" });
  });

  it("asks the layout for change_layout and the language for translate", async () => {
    const { c, sent } = client();
    renderChat({ client: c, target: { slideId: "s3" }, targetLabel: "Slide 3" });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("qaChangeLayout")) }));
    fireEvent.change(screen.getAllByLabelText(t("chooseLayout"))[0], { target: { value: "two-columns" } });
    fireEvent.click(screen.getByRole("button", { name: t("apply") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ action: "change_layout", action_input: "two-columns", target: { slideId: "s3" } });

    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("qaTranslate")) }));
    fireEvent.change(screen.getByLabelText(t("qaTranslateTo")), { target: { value: "Spanish" } });
    fireEvent.click(screen.getByRole("button", { name: t("apply") }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({ action: "translate", action_input: "Spanish", content: `${t("qaTranslate")} (Spanish)` });
  });

  it("forwards deck events and turns warnings into slide notices", async () => {
    const { c } = client({
      send: async (_body, onEvent) => {
        onEvent({ type: "deck.slide", run_id: "r", slide_id: "s2", slide: { id: "s2", elements: [] }, fallback: false });
        onEvent({ type: "warning", message: "TARGET_SCOPE: title", violation: { code: "TARGET_SCOPE", path: "slides/s2.json" } });
        onEvent({ type: "done", summary: "fait" });
      },
    });
    const { onEvent, onNotice } = renderChat({ client: c });
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent.mock.calls[0][0]).toMatchObject({ type: "deck.slide", slideId: "s2" });
    expect(onNotice).toHaveBeenCalledWith({ slideId: "s2", code: "TARGET_SCOPE", detail: "title" });
  });

  it("lets the user edit the outline, then confirms it", async () => {
    const { c, confirmed } = client({
      send: async (_body, onEvent) => {
        onEvent({ type: "deck.outline", run_id: "run-1", outline: {} });
        onEvent({
          type: "plan",
          run_id: "run-1",
          tasks: [
            { id: "s1", title: "Intro", status: "pending", detail: "Hook", layout: "title", visual: false },
            { id: "s2", title: "Marché", status: "pending", detail: "Taille", layout: "key-numbers", visual: true },
          ],
          meta: { title: "Pitch", summary: "Pour les investisseurs" },
          needs_confirm: true,
        });
      },
    });
    renderChat({ client: c });
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Un pitch" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    const outline = await screen.findByTestId("deck-outline");
    expect(outline).toHaveTextContent("Pitch");
    // Only the first slide is unfolded; the others open on click.
    expect(screen.getByLabelText(`${t("title")} 1`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`${t("title")} 2`)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Marché/ }));
    expect(screen.queryByLabelText(`${t("title")} 1`)).toBeNull();
    fireEvent.change(screen.getByLabelText(`${t("title")} 2`), { target: { value: "Le marché" } });
    fireEvent.click(screen.getByRole("button", { name: t("moveUp") }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("outlineConfirm") }));
    });
    await waitFor(() => expect(confirmed).toHaveLength(1));
    expect((confirmed[0] as { plan: { id: string; title: string }[] }).plan.map((p) => [p.id, p.title])).toEqual([
      ["s2", "Le marché"],
      ["s1", "Intro"],
    ]);
    expect(c.confirm).toHaveBeenCalledWith("run-1", expect.anything(), expect.any(Function), expect.anything());
  });

  it("restores an outline waiting for confirmation after a refresh", async () => {
    const { c } = client({
      active: async () => ({
        id: "run-9",
        status: "awaiting_plan_confirm",
        plan: [{ id: "s1", title: "Ouverture", detail: "", layout: "title", visual: false, status: "pending" }],
        plan_meta: { title: "Deck" },
      }),
    });
    renderChat({ client: c });
    expect(await screen.findByTestId("deck-outline")).toHaveTextContent("Deck");
    expect(screen.getByDisplayValue("Ouverture")).toBeInTheDocument();
  });

  it("says when credits are missing", async () => {
    const { c } = client({
      send: async () => {
        throw Object.assign(new Error("402"), { code: "INSUFFICIENT_CREDITS", status: 402 });
      },
    });
    renderChat({ client: c });
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t("insufficientCredits"));
  });

  it("opens the + menu and imports a PowerPoint sent with its slides", async () => {
    const { c, sent } = client();
    renderChat({ client: c });
    const plus = screen.getByRole("button", { name: t("attachMenu") });
    fireEvent.click(plus);
    const item = screen.getByRole("menuitem", { name: new RegExp(t("attachDocs")) });
    expect(item).toHaveTextContent(t("attachDocsHint"));
    const input = screen.getByTestId("deck-attach-input") as HTMLInputElement;
    const pick = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(item);
    expect(pick).toHaveBeenCalled();
    expect(input.accept).toContain(".pptx");
    expect(input.accept).not.toContain("image/");
    fireEvent.change(input, { target: { files: [new File(["x"], "ancien.pptx")] } });
    const list = await screen.findByRole("list", { name: t("attachList") });
    await waitFor(() => expect(list).toHaveTextContent(t("attachSlides", { n: 1 })));
    expect(list).toHaveTextContent("ancien.pptx");
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].content).toBe(`${t("attachPptxDefault")}\n\n[Document: ancien.pptx | pptx]\n--- Slide 1 ---\nTitle: Bilan 2026\n[/Document]`);
    // The history shows the file as a chip, not its text.
    expect(await screen.findByText("ancien.pptx")).toBeInTheDocument();
    expect(screen.queryByText(/Title: Bilan 2026/)).toBeNull();
  });

  it("sends a PDF with the typed request", async () => {
    const { c, sent } = client();
    renderChat({ client: c });
    fireEvent.change(screen.getByTestId("deck-attach-input"), { target: { files: [new File(["%PDF"], "rapport.pdf", { type: "application/pdf" })] } });
    const list = await screen.findByRole("list", { name: t("attachList") });
    expect(list).toHaveTextContent("rapport.pdf");
    fireEvent.change(screen.getByLabelText(t("chatPlaceholder")), { target: { value: "Un deck de 5 slides" } });
    await waitFor(() => expect(screen.getByRole("button", { name: t("send") })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].content).toBe("Un deck de 5 slides\n\n[Document: rapport.pdf | pdf]\nChiffres du rapport\n[/Document]");
  });

  it("sends an imported PowerPoint to the whole deck even with a slide selected", async () => {
    const { c, sent } = client();
    renderChat({ client: c, target: { slideId: "s1" }, targetLabel: "Slide 1" });
    expect(screen.getByTestId("deck-target")).toHaveTextContent("Slide 1");
    fireEvent.change(screen.getByTestId("deck-attach-input"), { target: { files: [new File(["x"], "ancien.pptx")] } });
    const list = await screen.findByRole("list", { name: t("attachList") });
    await waitFor(() => expect(list).toHaveTextContent(t("attachSlides", { n: 1 })));
    expect(screen.getByTestId("deck-target")).toHaveTextContent(t("targetDeck"));
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].target).toBeUndefined();
  });

  it("refuses a file over 5 MB and an unsupported type", async () => {
    const { c } = client();
    renderChat({ client: c });
    const big = new File(["x"], "gros.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByTestId("deck-attach-input"), { target: { files: [big, new File(["x"], "notes.docx")] } });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t("attachTooBig", { name: "gros.pdf" }));
    expect(alert).toHaveTextContent(t("attachUnsupported", { name: "notes.docx" }));
    expect(screen.queryByRole("list", { name: t("attachList") })).toBeNull();
  });

  it("says images need the image upload", async () => {
    const { c } = client();
    renderChat({ client: c });
    fireEvent.change(screen.getByTestId("deck-attach-input"), { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(t("attachNoImages", { name: "photo.png" }));
  });

  it("uploads an imported image and sends its path", async () => {
    const { c, sent } = client();
    const uploadImage = vi.fn(async () => ({ path: "public/images/photo.webp" }) as never);
    globalThis.URL.createObjectURL ??= () => "blob:x";
    globalThis.URL.revokeObjectURL ??= () => undefined;
    renderChat({ client: c, uploadImage });
    fireEvent.change(screen.getByTestId("deck-attach-input"), { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    await waitFor(() => expect(uploadImage).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: t("send") })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: t("send") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].content).toBe(`${t("attachDefault")}\n\n[Images: public/images/photo.webp]`);
  });
});
