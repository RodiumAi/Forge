import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDeckBundle, lucideIconFiles, lucideShim, pascalIconName, playerDir, playerLucideImports } from "../build.mjs";

test("kebab icon names map to lucide's PascalCase table", () => {
  assert.equal(pascalIconName("trending-up"), "TrendingUp");
  assert.equal(pascalIconName("arrow-up-0-1"), "ArrowUp01");
});

test("the shim exports the player's chrome icons and only the deck's icons", () => {
  const chrome = playerLucideImports(playerDir());
  assert.ok(chrome.has("ChevronLeft"));
  assert.ok(!chrome.has("LucideIcon"), "type imports are skipped");
  const shim = lucideShim(["trending-up", "rocket", "trending-up", "not-an-icon", "../evil"], chrome);
  assert.deepEqual(shim.found, ["trending-up", "rocket"]);
  assert.deepEqual(shim.missing, ["not-an-icon"]);
  assert.match(shim.code, /export const icons = \{ "TrendingUp": I0, "Rocket": I1 \};/);
  assert.match(shim.code, /export \{ default as ChevronLeft \}/);
  assert.ok(!shim.code.includes("evil"));
  assert.ok(lucideIconFiles().size > 1000);
});

test("the site bundle leaves unused icons out", async () => {
  const { code, icons } = await buildDeckBundle({ icons: ["rocket"], variant: "site" });
  assert.deepEqual(icons, ["rocket"]);
  assert.ok(code.includes('"rocket"') || code.includes("rocket"));
  assert.ok(!code.includes("alarm-clock"), "the full icon set is not bundled");
  assert.ok(!code.includes("__forgeDeck"), "the export API stays out of published sites");
  const exportBundle = await buildDeckBundle({ icons: [], variant: "export" });
  assert.ok(exportBundle.code.includes("__forgeDeck"));
});
