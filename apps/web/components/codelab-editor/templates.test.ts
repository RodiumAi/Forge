/**
 * The codelab kits in data/templates open in the editor: codelab.json passes
 * the web contract and every step parses into blocks the player renders.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { codelabSchema } from "@/lib/contracts/forge-design";
import { parseBlocks, walkBlocks } from "../codelab-player";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "data", "templates");
const kits = existsSync(ROOT) ? readdirSync(ROOT).filter((name) => name.startsWith("codelab-")) : [];

describe("codelab kits", () => {
  it("ships the eight codelab kits", () => {
    expect(kits.length).toBe(8);
  });

  it.each(kits)("%s is a valid codelab", (kit) => {
    const dir = join(ROOT, kit);
    const parsed = codelabSchema.safeParse(JSON.parse(readFileSync(join(dir, "codelab.json"), "utf8")));
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
    if (!parsed.success) return;
    const codelab = parsed.data;
    expect(codelab.durationMinutes).toBe(codelab.steps.reduce((sum, step) => sum + step.minutes, 0));
    const downloadIds = new Set((codelab.downloads ?? []).map((d) => d.id));
    for (const step of codelab.steps) {
      const markdown = readFileSync(join(dir, step.file), "utf8");
      const blocks = parseBlocks(markdown);
      expect(blocks.length, step.file).toBeGreaterThan(0);
      walkBlocks(blocks, (block) => {
        if (block.type !== "download") return;
        for (const item of block.items) {
          const known = downloadIds.has(item) || existsSync(join(dir, item.startsWith("files/") ? item : `files/${item}`));
          expect(known, `${step.file}: download ${item}`).toBe(true);
        }
      });
    }
    for (const item of codelab.downloads ?? []) expect(existsSync(join(dir, item.path)), item.path).toBe(true);
  });
});
