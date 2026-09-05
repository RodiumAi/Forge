/**
 * The contract behind every failure the user sees in the chat.
 *
 * The case that motivated this file: an empty RODI wallet used to reach the
 * builder as "Payment Required" — the bare HTTP status line — with a Retry
 * button that could only fail again. Two separate bugs, both covered here: the
 * body was parsed with a test that is false for the API's own error shape, and
 * nothing mapped the cause to an action.
 */

import { describe, expect, it } from "vitest";

import { ApiError, detailFromBody } from "@/lib/api";
import { classifyChatError, isRecoverableStreamError } from "@/lib/chat-errors";

describe("reading an API error body", () => {
  it("reads the API's own {code, message} shape", () => {
    // The exact body `app/errors.py` sends for a spent wallet. The parser this
    // replaces asked `typeof detail === "string"`, which is false here, and so
    // fell all the way back to the HTTP status text.
    const body = detailFromBody(
      {
        detail: {
          code: "INSUFFICIENT_RODI",
          message: "Insufficient RODI credits. Recharge your RodiumAi wallet to keep generating.",
        },
      },
      "Payment Required",
    );
    expect(body.code).toBe("INSUFFICIENT_RODI");
    expect(body.message).toContain("Insufficient RODI credits");
    expect(body.message).not.toBe("Payment Required");
  });

  it("still reads a plain string detail", () => {
    expect(detailFromBody({ detail: "Project not found" }, "Not Found")).toEqual({
      message: "Project not found",
    });
  });

  it("keeps FastAPI validation arrays readable", () => {
    const body = detailFromBody(
      { detail: [{ type: "string_too_short", loc: ["body", "token"], msg: "String is too short" }] },
      "Unprocessable Entity",
    );
    expect(body.message).toBe("String is too short");
    expect(body.code).toBeUndefined();
  });

  it("falls back rather than printing a shape it does not understand", () => {
    expect(detailFromBody({ detail: { unexpected: 1 } }, "Bad Request")).toEqual({
      message: "Bad Request",
    });
    expect(detailFromBody("not an object", "Bad Request")).toEqual({ message: "Bad Request" });
  });
});

describe("classifying a failure", () => {
  it("offers a top-up when the wallet is empty", () => {
    const info = classifyChatError(
      new ApiError("Insufficient RODI credits.", 402, "INSUFFICIENT_RODI"),
    );
    expect(info.labelKey).toBe("streamErrorQuota");
    expect(info.action).toEqual({ kind: "recharge" });
  });

  it("offers a top-up on a bare 402 too, code or no code", () => {
    // Older API builds, and any 402 we did not anticipate.
    const info = classifyChatError(new ApiError("Payment Required", 402));
    expect(info.action).toEqual({ kind: "recharge" });
  });

  it("offers to reconnect when the RodiumAi link is dead", () => {
    expect(classifyChatError(new ApiError("…", 403, "RODIUM_LINK_EXPIRED")).action).toEqual({
      kind: "reconnect-rodium",
    });
    expect(classifyChatError(new Error("…"), "auth_expired").action).toEqual({
      kind: "reconnect-rodium",
    });
  });

  it("sends a revoked key to settings, not to a retry", () => {
    const info = classifyChatError(new Error("…"), "invalid_key");
    expect(info.labelKey).toBe("streamErrorInvalidKey");
    expect(info.action).toEqual({ kind: "open-settings" });
  });

  it("offers to resume after a dropped connection — the work survived", () => {
    expect(classifyChatError(new Error("…"), "network").action).toEqual({ kind: "resume-plan" });
    expect(classifyChatError(new Error("…"), "timeout").action).toEqual({ kind: "resume-plan" });
  });

  it("gives no button when only the user can fix it", () => {
    expect(classifyChatError(new Error("…"), "payload_too_large").action).toEqual({ kind: "none" });
    expect(classifyChatError(new Error("…"), "cancelled").action).toEqual({ kind: "none" });
  });

  it("reads a code carried on any error, not just ApiError", () => {
    // SSE frames arrive as their own Error subclass.
    class StreamFailure extends Error {
      code = "quota";
    }
    expect(classifyChatError(new StreamFailure("boom")).action).toEqual({ kind: "recharge" });
  });

  it("keeps the server's own sentence for a cause it does not know", () => {
    const info = classifyChatError(new ApiError("Something specific went wrong", 418, "teapot"));
    expect(info.labelKey).toBeNull();
    expect(info.message).toBe("Something specific went wrong");
    expect(info.action).toEqual({ kind: "retry" });
  });

  it("classifies browser-side failures that never reached the server", () => {
    expect(classifyChatError(new TypeError("Failed to fetch")).code).toBe("network");
    expect(classifyChatError(new Error("stream ended early")).code).toBe("network");
  });
});

describe("deciding whether to reconnect silently", () => {
  it("reconnects on transport failures", () => {
    expect(isRecoverableStreamError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRecoverableStreamError(new Error("…"), "timeout")).toBe(true);
  });

  it("does not reconnect on failures that would just happen again", () => {
    // Reconnecting on an empty wallet is an infinite loop with a bill.
    expect(isRecoverableStreamError(new ApiError("…", 402, "INSUFFICIENT_RODI"))).toBe(false);
    expect(isRecoverableStreamError(new Error("…"), "auth_expired")).toBe(false);
    expect(isRecoverableStreamError(new Error("…"), "payload_too_large")).toBe(false);
  });
});
