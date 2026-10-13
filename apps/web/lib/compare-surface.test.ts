import { describe, expect, it } from "vitest";

import { rowSurface, showsOnForge } from "./compare-surface";

describe("rowSurface", () => {
  it("an explicit surface wins", () => {
    expect(rowSurface("projects", { surface: "code", forgeOnly: true })).toBe("code");
    expect(rowSurface("frodi", { surface: "forge" })).toBe("forge");
    expect(rowSurface("projects", { surface: "both" })).toBe("both");
  });

  it("falls back to forgeOnly, then to the default", () => {
    expect(rowSurface("frodi", { forgeOnly: true })).toBe("forge");
    expect(rowSurface("projects", { forgeOnly: false })).toBe("both");
    expect(rowSurface("frodi")).toBe("both");
    expect(rowSurface("projects")).toBe("forge");
    expect(rowSurface("projects", { surface: "nope" })).toBe("forge");
  });
});

describe("showsOnForge", () => {
  it("leaves out only the rows that apply to Code alone", () => {
    expect(showsOnForge("a", { surface: "code" })).toBe(false);
    expect(showsOnForge("a", { surface: "forge" })).toBe(true);
    expect(showsOnForge("a", { surface: "both" })).toBe(true);
    // Rows saved before `surface` existed are never Code only.
    expect(showsOnForge("a", { forgeOnly: false })).toBe(true);
    expect(showsOnForge("a")).toBe(true);
  });
});
