/**
 * `/auth/handoff` page: the production redirect loop.
 *
 * The finish leg clears `#code=…` with `history.replaceState`. Next syncs
 * `useSearchParams` with the History API, so the page re-renders and its effect
 * runs again with an EMPTY hash. That run used to look like a fresh start: it
 * asked the dashboard for a new code and aborted the sign-in in flight, forever.
 */

import { StrictMode } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CODE = "c".repeat(43);

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
}));

const handoff = vi.hoisted(() => ({
  start: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.params,
}));

vi.mock("@/components/auth/AuthCallbackScreen", () => ({
  AuthCallbackScreen: ({ error }: { error?: string | null }) => (
    <div data-testid="screen">{error ?? "working"}</div>
  ),
}));

vi.mock("@/lib/i18n/I18nProvider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/api", () => ({ api: vi.fn(), setToken: vi.fn() }));
vi.mock("@/lib/oauth-state", () => ({
  createHandoffBinding: vi.fn(),
  consumeHandoffBinding: vi.fn(),
}));

vi.mock("@/lib/rodium-handoff", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rodium-handoff")>(
    "@/lib/rodium-handoff",
  );
  return {
    ...actual,
    startRodiumHandoff: handoff.start,
    finishRodiumHandoff: handoff.finish,
  };
});

/** A fresh module per test: the page keeps its phase at module level. */
async function loadPage() {
  vi.resetModules();
  return (await import("./page")).default;
}

function openWithCode() {
  window.history.replaceState(null, "", `/auth/handoff#code=${CODE}`);
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  nav.push.mockReset();
  // The leg-1 redirect would navigate jsdom; these promises never settle.
  handoff.start.mockReset().mockImplementation(() => new Promise(() => {}));
  handoff.finish.mockReset().mockImplementation(() => new Promise(() => {}));
  sessionStorage.clear();
  window.history.replaceState(null, "", "/auth/handoff");
});

afterEach(() => {
  cleanup();
});

describe("/auth/handoff", () => {
  it("does not start a new handoff when the effect re-runs after replaceState", async () => {
    const Page = await loadPage();
    openWithCode();

    const view = render(<Page />);
    await waitFor(() => expect(handoff.finish).toHaveBeenCalledTimes(1));
    // replaceState emptied the hash.
    expect(window.location.hash).toBe("");

    // Next hands the page a new `searchParams` object after replaceState.
    nav.params = new URLSearchParams();
    view.rerender(<Page />);
    nav.params = new URLSearchParams();
    view.rerender(<Page />);

    expect(handoff.start).not.toHaveBeenCalled();
    expect(handoff.finish).toHaveBeenCalledTimes(1);
  });

  it("finishes once and never starts under Strict Mode's double mount", async () => {
    const Page = await loadPage();
    openWithCode();

    render(
      <StrictMode>
        <Page />
      </StrictMode>,
    );
    await waitFor(() => expect(handoff.finish).toHaveBeenCalledTimes(1));

    expect(handoff.start).not.toHaveBeenCalled();
  });

  it("starts the handoff once when there is no code", async () => {
    const Page = await loadPage();

    const view = render(
      <StrictMode>
        <Page />
      </StrictMode>,
    );
    await waitFor(() => expect(handoff.start).toHaveBeenCalledTimes(1));
    view.rerender(
      <StrictMode>
        <Page />
      </StrictMode>,
    );

    expect(handoff.start).toHaveBeenCalledTimes(1);
    expect(handoff.finish).not.toHaveBeenCalled();
  });

  it("lands on the destination and forgets the retry marker on success", async () => {
    const Page = await loadPage();
    sessionStorage.setItem("forge_handoff_retry", "1");
    handoff.finish.mockResolvedValueOnce("/dashboard");
    openWithCode();

    render(<Page />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard"));
    expect(sessionStorage.getItem("forge_handoff_retry")).toBeNull();
  });

  it("shows the error instead of restarting once the single retry was spent", async () => {
    const Page = await loadPage();
    // The dashboard round trip drops `?retry=1`; the marker survives it.
    sessionStorage.setItem("forge_handoff_retry", "1");
    handoff.finish.mockRejectedValueOnce(new Error("expired"));
    openWithCode();

    const view = render(<Page />);

    await waitFor(() =>
      expect(view.getByTestId("screen")).toHaveTextContent("handoffExpired"),
    );
    expect(handoff.start).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("forge_handoff_retry")).toBeNull();
  });
});
