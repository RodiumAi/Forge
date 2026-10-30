import { describe, expect, it } from "vitest";
import { lucideIcon, lucideIconNames } from "./icons";

describe("lucide icon names", () => {
  it("lists every icon under a name that resolves back to it", () => {
    const names = lucideIconNames();
    expect(names.length).toBeGreaterThan(1000);
    expect(names).toContain("chart-bar");
    expect(names).toContain("arrow-right");
    for (const name of names) expect(lucideIcon(name)).not.toBeNull();
  });
});
