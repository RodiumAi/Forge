import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Codelab } from "@/lib/contracts/forge-design";
import type { CodelabChatClient } from "./api";

const server = vi.hoisted(() => ({
  codelab: null as unknown as Codelab,
  steps: {} as Record<string, string>,
  version: 1,
  puts: [] as { kind: string; id?: string; body: unknown; etag: string | null }[],
}));

vi.mock("./api", () => {
  class Conflict extends Error {
    status = 409;
  }
  return {
    getCodelab: vi.fn(async () => ({ data: structuredClone(server.codelab), etag: `"c${server.version}"` })),
    putCodelab: vi.fn(async (_p: string, doc: Codelab, etag: string | null) => {
      server.puts.push({ kind: "codelab", body: doc, etag });
      server.codelab = structuredClone(doc);
      for (const step of doc.steps) if (!(step.id in server.steps)) server.steps[step.id] = `# ${step.title ?? step.id}\n`;
      server.version += 1;
      return { data: doc, etag: `"c${server.version}"` };
    }),
    getStep: vi.fn(async (_p: string, id: string) => ({ data: { id, file: "", markdown: server.steps[id] ?? "" }, etag: `"s-${id}"` })),
    putStep: vi.fn(async (_p: string, id: string, markdown: string, etag: string | null) => {
      server.puts.push({ kind: "step", id, body: markdown, etag });
      server.steps[id] = markdown;
      return { data: { id, file: "", markdown }, etag: `"s-${id}-2"` };
    }),
    getDesign: vi.fn(async () => "--bg: #ffffff\n--accent: #ff6600"),
    getSettings: vi.fn(async () => ({})),
    putSettings: vi.fn(async (_p: string, s: unknown) => s),
    listFiles: vi.fn(async () => [{ path: "files/starter/main.py", size: 120 }]),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    importClaat: vi.fn(),
    downloadFrom: vi.fn(),
    isConflict: (e: unknown) => e instanceof Conflict,
  };
});

import { CodelabEditor } from "./CodelabEditor";

function chatClient(events: Record<string, unknown>[] = []): CodelabChatClient & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    sent,
    messages: async () => [],
    active: async () => null,
    send: async (body, onEvent) => {
      sent.push(body);
      for (const event of events) onEvent(event);
    },
    confirm: async () => undefined,
    subscribe: async () => undefined,
    cancel: async () => undefined,
  };
}

function setup(chat = chatClient()) {
  localStorage.setItem("forge_locale", "fr");
  render(
    <I18nProvider>
      <CodelabEditor projectId="p1" projectName="Demo" chat={chat} assetUrl={(p) => p} publisher={null} backHref="/dashboard" />
    </I18nProvider>,
  );
  return chat;
}

beforeEach(() => {
  server.codelab = {
    version: 1,
    title: "API REST",
    level: "beginner",
    durationMinutes: 15,
    steps: [
      { id: "intro", title: "Introduction", file: "steps/01-intro.md", minutes: 5 },
      { id: "routes", title: "Routes", file: "steps/02-routes.md", minutes: 10 },
    ],
  };
  server.steps = { intro: "# Introduction\n\nBonjour.", routes: "# Routes\n" };
  server.version = 1;
  server.puts = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CodelabEditor", () => {
  it("lists the steps and previews the selected one", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "Étapes" });
    expect(within(nav).getByText("Introduction")).toBeTruthy();
    expect(within(nav).getByText("Total : 15 min")).toBeTruthy();
    const area = screen.getByLabelText("Markdown de l'étape") as HTMLTextAreaElement;
    expect(area.value).toContain("Bonjour.");
    expect(screen.getByLabelText("Aperçu").textContent).toContain("Bonjour.");
  });

  it("saves a step edit with If-Match after the debounce", async () => {
    setup();
    const area = (await screen.findByLabelText("Markdown de l'étape")) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "# Introduction\n\nSalut." } });
    expect(screen.getByLabelText("Aperçu").textContent).toContain("Salut.");
    await waitFor(() => expect(server.puts.some((p) => p.kind === "step")).toBe(true), { timeout: 2000 });
    expect(server.puts.find((p) => p.kind === "step")).toMatchObject({ id: "intro", etag: '"s-intro"' });
  });

  it("inserts a toolbar block in the step", async () => {
    setup();
    const area = (await screen.findByLabelText("Markdown de l'étape")) as HTMLTextAreaElement;
    area.setSelectionRange(area.value.length, area.value.length);
    fireEvent.click(screen.getByTitle("Terminal"));
    expect(area.value).toContain("```terminal\n$ npm install");
  });

  it("adds, reorders and deletes steps through codelab.json", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "Étapes" });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une étape/ }));
    await waitFor(() => expect(server.codelab.steps).toHaveLength(3));
    expect(server.codelab.steps[1]).toMatchObject({ id: "nouvelle-etape", file: "steps/03-nouvelle-etape.md" });
    await waitFor(() => expect((screen.getByLabelText("Markdown de l'étape") as HTMLTextAreaElement).value).toBe("# Nouvelle étape\n"));

    fireEvent.click(within(nav).getAllByRole("button", { name: "Monter" })[1]);
    await waitFor(() => expect(server.codelab.steps.map((s) => s.id)).toEqual(["nouvelle-etape", "intro", "routes"]), { timeout: 2000 });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(nav).getAllByRole("button", { name: "Supprimer l'étape" })[2]);
    await waitFor(() => expect(server.codelab.steps.map((s) => s.id)).toEqual(["nouvelle-etape", "intro"]));
    expect(server.codelab.durationMinutes).toBe(10);
  });

  it("sends a message targeting the selected step and streams the answer into the preview", async () => {
    const chat = setup(
      chatClient([
        { type: "codelab.delta", run_id: "r", step_id: "intro", text: "# Introduction\n\nTexte streamé" },
      ]),
    );
    const input = await screen.findByPlaceholderText("Modifier l'étape « Introduction »...");
    fireEvent.change(input, { target: { value: "Plus court" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(chat.sent[0]).toEqual({ content: "Plus court", mode: "agent", target: { stepId: "intro" } });
    await waitFor(() => expect(screen.getByLabelText("Aperçu").textContent).toContain("Texte streamé"));
  });

  it("asks for the code check without a target", async () => {
    const chat = setup(chatClient([{ type: "codelab.check", summary: "RAS", issues: [] }, { type: "done" }]));
    fireEvent.click(await screen.findByRole("button", { name: "Vérifier le code" }));
    await waitFor(() => expect(screen.getByTestId("codelab-check").textContent).toContain("Aucun problème trouvé."));
    expect(chat.sent[0]).toEqual({ content: "Vérifier le code", mode: "agent", action: "check_code" });
  });

  it("offers a project file as a download", async () => {
    setup();
    fireEvent.click(await screen.findByRole("tab", { name: /Fichiers/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Proposer en téléchargement" }));
    await waitFor(() => expect(server.codelab.downloads).toEqual([{ id: "main", label: "main.py", path: "files/starter/main.py" }]));
    expect((screen.getByLabelText("Markdown de l'étape") as HTMLTextAreaElement).value).toContain("```download\nmain\n```");
  });
});
