/**
 * The open-redirect guard behind post-auth landing.
 *
 * `land()` on login/register and the OAuth return-to both feed a caller-supplied
 * `next` into `window.location.assign`. Anything that is not a same-origin path
 * must be dropped, or `?next=https://evil.example` turns the trusted auth page
 * into a redirector.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sanitizeReturnTo } from "@/lib/rodium-oauth";

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
