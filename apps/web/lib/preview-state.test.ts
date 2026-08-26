import { describe, expect, it } from "vitest";
import { buildPreviewSrc, reducePreviewLive } from "./preview-state";

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

describe("reducePreviewLive", () => {
  it("ignores empty documents", () => {
    expect(reducePreviewLive(null, "")).toBeNull();
    expect(reducePreviewLive({}, "")).toBeNull();
  });

  it("marks the preview busy while starting", () => {
    expect(reducePreviewLive({ status: "starting" }, "")).toEqual({ busy: true });
  });

  it("does not remount on the first ready snapshot", () => {
    expect(reducePreviewLive({ status: "ready", url: "/runner/" }, "")).toEqual({
      url: "/runner/",
      busy: false,
      remount: false,
    });
  });

  it("does not remount on a duplicate ready snapshot", () => {
    expect(reducePreviewLive({ status: "ready", url: "/runner/" }, "ready")).toMatchObject({
      remount: false,
    });
  });

  it("remounts when the preview comes back after being down", () => {
    expect(reducePreviewLive({ status: "ready", url: "/runner/" }, "dead")).toMatchObject({
      remount: true,
    });
  });

  it("clears the url when the preview dies", () => {
    expect(reducePreviewLive({ status: "dead" }, "ready")).toEqual({ busy: false, url: null });
  });

  it("surfaces the error message on error", () => {
    expect(reducePreviewLive({ status: "error", error: "boom" }, "ready")).toEqual({
      busy: false,
      url: null,
      error: "boom",
    });
  });

  it("does not invent an error message when none is provided", () => {
    expect(reducePreviewLive({ status: "error" }, "ready")).toEqual({
      busy: false,
      url: null,
      error: undefined,
    });
  });

  it("only clears busy when stopped, keeping the url", () => {
    expect(reducePreviewLive({ status: "stopped" }, "ready")).toEqual({ busy: false });
  });

  it("ignores unknown statuses without changing anything", () => {
    expect(reducePreviewLive({ status: "whatever" }, "ready")).toEqual({});
  });
});
