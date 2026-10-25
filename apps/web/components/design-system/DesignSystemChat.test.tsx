import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, waitFor } from "@/test/render";

import { DesignSystemChat } from "./DesignSystemChat";

const state = vi.hoisted(() => ({ messages: [] as { id: string; role: string; content: string }[] }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: vi.fn(async (path: string) => (path.endsWith("/chats") ? [{ id: "c1" }] : state.messages)),
  };
});

const authFetch = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ authFetch }));

function sse(): Response {
  const body = 'data: {"type":"done","summary":"ok"}\n\n';
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("DesignSystemChat boot prompt", () => {
  it("sends the home prompt once into an empty conversation, then reports it", async () => {
    state.messages = [];
    authFetch.mockReset().mockImplementation(async () => sse());
    const used = vi.fn();
    const done = vi.fn();
    renderWithProviders(
      <DesignSystemChat
        projectId="p1"
        section="colors"
        onDocument={() => {}}
        initialPrompt="Nom de la marque : Nova"
        onInitialPromptUsed={used}
        onInitialPromptDone={done}
      />,
    );
    await waitFor(() => expect(done).toHaveBeenCalledWith(true));
    expect(authFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(authFetch.mock.calls[0][1].body));
    expect(body.content).toBe("Nom de la marque : Nova");
    expect(used).toHaveBeenCalledTimes(1);
  });

  it("does not resend when the conversation already started", async () => {
    state.messages = [{ id: "m1", role: "user", content: "earlier" }];
    authFetch.mockReset().mockImplementation(async () => sse());
    const used = vi.fn();
    renderWithProviders(
      <DesignSystemChat projectId="p2" section="colors" onDocument={() => {}} initialPrompt="again" onInitialPromptUsed={used} />,
    );
    await waitFor(() => expect(used).toHaveBeenCalledTimes(1));
    expect(authFetch).not.toHaveBeenCalled();
  });
});
