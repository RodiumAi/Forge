import { describe, expect, it, vi } from "vitest";

import {
  formatPagesMarker,
  nextPageSelection,
  pageLabel,
  PageThumbCache,
  parsePagesMarker,
  stripPagesMarker,
  THUMB_MAX_CHARS,
  THUMB_STORAGE_BUDGET,
  type ThumbStorage,
} from "./page-rail-model";
import { parseUserMessageContent } from "@/lib/prompt-attachments";

const IMG = `data:image/webp;base64,${"A".repeat(2000)}`;

function memoryStorage(): ThumbStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("pageLabel", () => {
  it("names the home page and keeps the other routes readable", () => {
    expect(pageLabel("/", "Accueil")).toBe("Accueil");
    expect(pageLabel("", "Home")).toBe("Home");
    expect(pageLabel("/carte", "Accueil")).toBe("carte");
    expect(pageLabel("/carte/", "Accueil")).toBe("carte");
    expect(pageLabel("/menu/plats", "Accueil")).toBe("menu / plats");
    expect(pageLabel("/caf%C3%A9?x=1", "Accueil")).toBe("café");
  });
});

describe("nextPageSelection", () => {
  const all = ["/", "/carte", "/contact", "/equipe"];

  it("toggles one page and keeps the route order", () => {
    expect(nextPageSelection([], "/contact", "toggle", all)).toEqual(["/contact"]);
    expect(nextPageSelection(["/contact"], "/", "toggle", all)).toEqual(["/", "/contact"]);
    expect(nextPageSelection(["/", "/contact"], "/", "toggle", all)).toEqual(["/contact"]);
  });

  it("selects a range from the anchor in either direction", () => {
    expect(nextPageSelection([], "/contact", "range", all, "/")).toEqual(["/", "/carte", "/contact"]);
    expect(nextPageSelection(["/equipe"], "/carte", "range", all, "/equipe")).toEqual([
      "/carte",
      "/contact",
      "/equipe",
    ]);
  });

  it("falls back to a toggle without a usable anchor, and drops vanished routes", () => {
    expect(nextPageSelection(["/gone"], "/carte", "range", all, "/gone")).toEqual(["/carte"]);
    expect(nextPageSelection(["/", "/carte"], "/equipe", "only", all)).toEqual(["/equipe"]);
  });
});

describe("PageThumbCache", () => {
  it("keeps snapshots per project and route and notifies subscribers", () => {
    const cache = new PageThumbCache(null);
    const fn = vi.fn();
    const off = cache.subscribe(fn);
    expect(cache.set("p1", "/", IMG)).toBe(true);
    expect(cache.get("p1", "/")).toBe(IMG);
    expect(cache.get("p2", "/")).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    // Same picture again: no new notification.
    cache.set("p1", "/", IMG);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    cache.set("p1", "/carte", IMG);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("refuses anything that is not a small image data URL", () => {
    const cache = new PageThumbCache(null);
    expect(cache.set("p1", "/", "javascript:alert(1)")).toBe(false);
    expect(cache.set("p1", "/", "data:text/html;base64,AAAA")).toBe(false);
    expect(cache.set("p1", "/", `data:image/jpeg;base64,${"A".repeat(THUMB_MAX_CHARS)}`)).toBe(false);
    expect(cache.get("p1", "/")).toBeNull();
  });

  it("survives a reload through storage and evicts the oldest past the budget", () => {
    const storage = memoryStorage();
    let clock = 0;
    const first = new PageThumbCache(storage, () => ++clock);
    const big = `data:image/webp;base64,${"B".repeat(100_000)}`;
    const count = Math.ceil(THUMB_STORAGE_BUDGET / 100_000) + 2;
    for (let i = 0; i < count; i++) first.set("p1", `/p${i}`, big);
    const second = new PageThumbCache(storage);
    expect(second.get("p1", `/p${count - 1}`)).toBe(big);
    expect(second.get("p1", "/p0")).toBeNull();
  });

  it("works when storage throws", () => {
    const broken: ThumbStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const cache = new PageThumbCache(broken);
    expect(cache.set("p1", "/", IMG)).toBe(true);
    expect(cache.get("p1", "/")).toBe(IMG);
  });
});

describe("pages marker", () => {
  it("round-trips the selected routes", () => {
    const marker = formatPagesMarker(["/", "/carte"], "Pages ciblées", "Accueil");
    expect(marker).toBe("[Pages ciblées: / (Accueil), /carte]");
    expect(parsePagesMarker(`${marker}\n\nAgrandis le titre`)).toEqual(["/", "/carte"]);
    expect(parsePagesMarker("[Target pages: /menu/plats, /]")).toEqual(["/menu/plats", "/"]);
    expect(stripPagesMarker(`${marker}\n\nAgrandis`).trim()).toBe("Agrandis");
    expect(formatPagesMarker([], "Target pages", "Home")).toBe("");
    expect(parsePagesMarker("no marker")).toEqual([]);
  });
});

describe("sent message with pages", () => {
  it("shows the pages as a tag and keeps the prose clean", () => {
    const parsed = parseUserMessageContent("[Pages ciblées: / (Accueil), /carte]\n\nAgrandis le titre");
    expect(parsed.pages).toEqual(["/", "/carte"]);
    expect(parsed.text).toBe("Agrandis le titre");
  });
});
