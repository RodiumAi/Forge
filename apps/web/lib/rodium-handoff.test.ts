/**
 * "Open Forge" handoff: the start leg only ever sends a hash to the dashboard,
 * and the finish leg refuses a code this tab did not ask for.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const binding = vi.hoisted(() => ({
  create: vi.fn(async () => "f".repeat(64)),
  consume: vi.fn((): string | null => "a".repeat(64)),
}));

vi.mock("@/lib/oauth-state", () => ({
  createHandoffBinding: binding.create,
  consumeHandoffBinding: binding.consume,
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock("@/lib/session-cache", () => ({
  clearSessionCache: vi.fn(),
  prepareSessionAfterRodiumLogin: vi.fn(async () => null),
}));

import { api, setToken } from "@/lib/api";
import {
  HandoffMismatchError,
  autostartLoginPath,
  dashboardHandoffUrl,
  finishRodiumHandoff,
  parseHandoffFragment,
  startRodiumHandoff,
} from "@/lib/rodium-handoff";

const apiMock = vi.mocked(api);

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "https://forge.rodiumai.io" } });
  vi.stubEnv("NEXT_PUBLIC_RODIUM_USER_APP_URL", "https://rodiumai.io");
  apiMock.mockReset();
  binding.create.mockClear();
  binding.consume.mockReset().mockReturnValue("a".repeat(64));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseHandoffFragment", () => {
  it("reads code and next", () => {
    expect(parseHandoffFragment("#code=abc&next=%2Fprojects")).toEqual({
      code: "abc",
      next: "/projects",
    });
  });

  it("treats an empty fragment as the start leg", () => {
    expect(parseHandoffFragment("")).toEqual({ code: null, next: null });
  });
});

describe("dashboardHandoffUrl", () => {
  it("targets the www dashboard minting page with the hash only", () => {
    const url = new URL(dashboardHandoffUrl("f".repeat(64), "/projects"));
    expect(url.origin).toBe("https://www.rodiumai.io");
    expect(url.pathname).toBe("/forge/handoff");
    expect(url.searchParams.get("binding")).toBe("f".repeat(64));
    expect(url.searchParams.get("next")).toBe("/projects");
  });
});

describe("startRodiumHandoff", () => {
  it("sends the tab to the dashboard when the API supports the handoff", async () => {
    apiMock.mockResolvedValueOnce({ rodium_handoff: true });
    const result = await startRodiumHandoff("/projects");
    const url = new URL(result.url);
    expect(url.pathname).toBe("/forge/handoff");
    expect(url.searchParams.get("binding")).toBe("f".repeat(64));
  });

  it("falls back to the OIDC autostart without handoff support", async () => {
    apiMock.mockResolvedValueOnce({ rodium_handoff: false });
    expect((await startRodiumHandoff(null)).url).toBe(autostartLoginPath(null));
    expect(binding.create).not.toHaveBeenCalled();
  });

  it("falls back when the tab cannot keep a secret", async () => {
    apiMock.mockResolvedValueOnce({ rodium_handoff: true });
    binding.create.mockResolvedValueOnce("");
    expect((await startRodiumHandoff(null)).url).toBe(autostartLoginPath(null));
  });

  it("drops a next that leaves Forge", async () => {
    apiMock.mockResolvedValueOnce({ rodium_handoff: true });
    const url = new URL((await startRodiumHandoff("https://evil.example")).url);
    expect(url.searchParams.has("next")).toBe(false);
  });
});

describe("finishRodiumHandoff", () => {
  it("redeems code + tab secret and lands on next", async () => {
    apiMock.mockResolvedValueOnce({ access_token: "forge-jwt" });
    const dest = await finishRodiumHandoff({ code: "c".repeat(43), next: "/projects" });
    expect(dest).toBe("/projects");
    expect(apiMock).toHaveBeenCalledWith("/auth/rodium/handoff", {
      method: "POST",
      body: JSON.stringify({ code: "c".repeat(43), binding: "a".repeat(64) }),
    });
    expect(setToken).toHaveBeenLastCalledWith("forge-jwt");
  });

  it("refuses a code this tab never asked for", async () => {
    binding.consume.mockReturnValueOnce(null);
    await expect(
      finishRodiumHandoff({ code: "c".repeat(43), next: null }),
    ).rejects.toBeInstanceOf(HandoffMismatchError);
    expect(apiMock).not.toHaveBeenCalled();
  });
});
