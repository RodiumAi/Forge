import { describe, expect, it } from "vitest";
import { buildPreviewSrc } from "./preview-state";

const API = "http://localhost:8100";

describe("buildPreviewSrc", () => {
  it("returns null without a url", () => {
    expect(buildPreviewSrc(null, 1, API)).toBeNull();
  });

  it("keeps an absolute runner url as-is and busts the cache", () => {
    expect(buildPreviewSrc("http://localhost:8100/runner/", 3, API)).toBe(
      "http://localhost:8100/runner/?t=3",
    );
  });

  it("prefixes a relative path with the api origin", () => {
    expect(buildPreviewSrc("/runner/", 2, API)).toBe("http://localhost:8100/runner/?t=2");
  });

  it("tolerates a path without a leading slash", () => {
    expect(buildPreviewSrc("runner/", 2, API)).toBe("http://localhost:8100/runner/?t=2");
  });

  it("appends with & when the url already has a query", () => {
    expect(buildPreviewSrc("/runner/?x=1", 4, API)).toBe("http://localhost:8100/runner/?x=1&t=4");
  });

  it("changes when the remount key changes", () => {
    const a = buildPreviewSrc("/runner/", 1, API);
    const b = buildPreviewSrc("/runner/", 2, API);
    expect(a).not.toBe(b);
  });
});
