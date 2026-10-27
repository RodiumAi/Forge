import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { isBenignException, sanitizeCaptureResult } from "./sanitize-event";

function exception(value: string, type = "Error"): CaptureResult {
  return {
    uuid: "u",
    event: "$exception",
    properties: { $exception_list: [{ type, value }] },
  } as unknown as CaptureResult;
}

describe("sanitizeCaptureResult", () => {
  it.each([
    "ResizeObserver loop completed with undelivered notifications.",
    "ResizeObserver loop limit exceeded",
    "Script error.",
    "The user aborted a request.",
    "signal is aborted without reason",
    "INTERNAL ASSERTION FAILED: Pending promise was never set",
    "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
    "Internal error opening backing store for indexedDB.open.",
    "PostHog request timed out after 60000ms",
  ])("drops the benign exception %s", (message) => {
    expect(sanitizeCaptureResult(exception(message))).toBeNull();
  });

  it("drops an AbortError identified only by its type", () => {
    expect(sanitizeCaptureResult(exception("", "AbortError"))).toBeNull();
  });

  it("keeps real application errors", () => {
    const real = exception("Loading chunk 44814 failed.", "ChunkLoadError");
    expect(sanitizeCaptureResult(real)).toBe(real);
    const typeError = exception("Cannot read properties of undefined", "TypeError");
    expect(sanitizeCaptureResult(typeError)).toBe(typeError);
  });

  it("does not drop non-exception events whose payload mentions a benign text", () => {
    const result = {
      uuid: "u",
      event: "$autocapture",
      properties: { $exception_list: [{ type: "AbortError", value: "x" }] },
    } as unknown as CaptureResult;
    expect(sanitizeCaptureResult(result)).toBe(result);
  });

  it("scrubs tokens from the page URL, referrer, person and custom properties", () => {
    const result = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://forge.rodiumai.io/reset-password?token=SECRET",
        $referrer: "https://mail.example.com/?t=1#frag",
        page_url: "https://forge.rodiumai.io/auth/handoff#code=SECRET",
      },
      $set_once: {
        $initial_current_url: "https://forge.rodiumai.io/verify-email?token=SECRET",
      },
    } as unknown as CaptureResult;
    const out = sanitizeCaptureResult(result);
    expect(JSON.stringify(out)).not.toContain("SECRET");
    expect(out?.properties.$current_url).toBe(
      "https://forge.rodiumai.io/reset-password",
    );
    expect(out?.$set_once?.$initial_current_url).toBe(
      "https://forge.rodiumai.io/verify-email",
    );
  });

  it("never lets an email or phone number through", () => {
    const result = {
      uuid: "u",
      event: "$identify",
      properties: { email: "a@b.com", $email: "a@b.com", plan: "free" },
      $set: { email: "a@b.com", phone: "+22900000000", role: "user" },
      $set_once: { $email: "a@b.com" },
    } as unknown as CaptureResult;
    const out = sanitizeCaptureResult(result);
    expect(JSON.stringify(out)).not.toContain("a@b.com");
    expect(JSON.stringify(out)).not.toContain("22900000000");
    expect(out?.properties.plan).toBe("free");
    expect(out?.$set?.role).toBe("user");
  });

  it("passes null through", () => {
    expect(sanitizeCaptureResult(null)).toBeNull();
  });
});

describe("isBenignException", () => {
  it("reads the legacy flat arrays too", () => {
    expect(
      isBenignException({ $exception_values: ["Script error."] }),
    ).toBe(true);
    expect(isBenignException({})).toBe(false);
  });
});
