import { describe, expect, it } from "vitest";
import { currentPreset } from "./presets";

const deck = (types: (string | undefined)[]) => ({
  deck: { slides: types.map((type) => (type ? { transition: { type } } : {})) as { transition?: never }[] },
});

describe("current preset", () => {
  it("names the preset every slide's transition matches", () => {
    expect(currentPreset(deck(["fade", "fade"]))).toBe("sober");
    expect(currentPreset(deck(["push", "push"]))).toBe("dynamic");
    expect(currentPreset(deck(["morph"]))).toBe("elegant");
  });

  it("is null when slides differ, lack a transition or there are none", () => {
    expect(currentPreset(deck(["fade", "push"]))).toBeNull();
    expect(currentPreset(deck(["fade", undefined]))).toBeNull();
    expect(currentPreset(deck([]))).toBeNull();
  });
});
