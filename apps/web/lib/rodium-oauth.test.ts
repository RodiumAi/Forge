/**
 * The open-redirect guard behind post-auth landing + RodiumAi popup kick-off.
 *
 * `land()` on login/register and the OAuth return-to both feed a caller-supplied
 * `next` into `window.location.assign`. Anything that is not a same-origin path
 * must be dropped, or `?next=https://evil.example` turns the trusted auth page
 * into a redirector.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OAUTH_POPUP_MESSAGE_TYPE,
  OAUTH_POPUP_WINDOW_NAME,
  sanitizeReturnTo,
  startRodiumOAuth,
} from "@/lib/rodium-oauth";

describe("sanitizeReturnTo", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "https://forge.rodiumai.io" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a relative same-origin path", () => {
    expect(sanitizeReturnTo("/dashboard?tab=x#y")).toBe("/dashboard?tab=x#y");
  });

  it("keeps an absolute same-origin URL as a path", () => {
    expect(sanitizeReturnTo("https://forge.rodiumai.io/settings?tab=generation")).toBe(
      "/settings?tab=generation",
    );
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "http://forge.rodiumai.io.evil.example/",
    "javascript:alert(1)",
    "  ",
    "",
    null,
    undefined,
  ])("rejects %p", (value) => {
    expect(sanitizeReturnTo(value)).toBeNull();
  });
});

describe("startRodiumOAuth popup", () => {
  const sessionStore = new Map<string, string>();

  beforeEach(() => {
    sessionStore.clear();
    vi.stubGlobal("window", {
      location: {
        origin: "https://forge.rodiumai.io",
        href: "https://forge.rodiumai.io/login",
        assign: vi.fn(),
      },
      open: vi.fn(),
      screenLeft: 0,
      screenTop: 0,
      screenX: 0,
      screenY: 0,
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });
    vi.stubGlobal("document", { documentElement: { clientWidth: 1200, clientHeight: 800 } });
    vi.stubGlobal("screen", { width: 1200, height: 800 });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        sessionStore.set(k, v);
      },
      removeItem: (k: string) => {
        sessionStore.delete(k);
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports popup_blocked when window.open returns null", async () => {
    (window.open as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = await startRodiumOAuth({ returnTo: "/dashboard", mode: "popup" });
    expect(result).toEqual({ ok: false, reason: "popup_blocked" });
    expect(window.open).toHaveBeenCalledWith(
      "/auth/rodium-popup?prompt=login",
      OAUTH_POPUP_WINDOW_NAME,
      expect.stringContaining("width=520"),
    );
  });

  it("opens the named popup and resolves when the opener receives the message", async () => {
    const popup = { closed: false, focus: vi.fn() };
    (window.open as ReturnType<typeof vi.fn>).mockReturnValue(popup);

    const listeners = new Map<string, Set<(event: unknown) => void>>();
    (window.addEventListener as ReturnType<typeof vi.fn>).mockImplementation(
      (type: string, handler: (event: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
    );
    (window.removeEventListener as ReturnType<typeof vi.fn>).mockImplementation(
      (type: string, handler: (event: unknown) => void) => {
        listeners.get(type)?.delete(handler);
      },
    );

    const pending = startRodiumOAuth({ returnTo: "/settings?tab=generation", mode: "popup" });

    // Simulate popup success message.
    const messageHandlers = listeners.get("message");
    expect(messageHandlers?.size).toBeGreaterThan(0);
    messageHandlers!.forEach((handler) =>
      handler({
        origin: "https://forge.rodiumai.io",
        data: { type: OAUTH_POPUP_MESSAGE_TYPE, ok: true },
      }),
    );

    const result = await pending;
    expect(result).toEqual({ ok: true, mode: "popup" });
    expect(window.location.assign).toHaveBeenCalledWith("/settings?tab=generation");
  });
});
