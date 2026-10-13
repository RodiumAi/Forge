import { describe, expect, it } from "vitest";
import { isSameBuilderUrl } from "./builder-url-state";

describe("isSameBuilderUrl", () => {
  it("matches an identical path and query", () => {
    expect(isSameBuilderUrl("/projects/p1?view=code", "/projects/p1", "?view=code")).toBe(true);
  });

  it("matches a bare path with no query", () => {
    expect(isSameBuilderUrl("/projects/p1", "/projects/p1", "")).toBe(true);
    expect(isSameBuilderUrl("/projects/p1", "/projects/p1", "?")).toBe(true);
  });

  it("ignores parameter order", () => {
    expect(
      isSameBuilderUrl("/projects/p1?view=code&pane=chat", "/projects/p1", "?pane=chat&view=code"),
    ).toBe(true);
  });

  it("detects a different query", () => {
    expect(isSameBuilderUrl("/projects/p1?view=code", "/projects/p1", "?view=preview")).toBe(false);
    expect(isSameBuilderUrl("/projects/p1", "/projects/p1", "?view=code")).toBe(false);
    expect(isSameBuilderUrl("/projects/p1?view=code", "/projects/p1", "")).toBe(false);
  });

  it("detects a different path", () => {
    expect(isSameBuilderUrl("/projects/p2?view=code", "/projects/p1", "?view=code")).toBe(false);
  });
});
