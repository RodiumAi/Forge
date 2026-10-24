import { describe, expect, it } from "vitest";

import { buildChatTarget, forgeIdLabel, parseForgeId, scopeRefusedPaths } from "./edit-target";
import { formatElementSelectionMarker, parseElementSelectionMarker } from "./prompt-attachments";

describe("forge ids", () => {
  it("parses <file>:<line>:<col>", () => {
    expect(parseForgeId("src/components/Hero.tsx:12:5")).toEqual({
      file: "src/components/Hero.tsx",
      line: 12,
      col: 5,
    });
    expect(parseForgeId("src/a.css:1:1")).toBeNull();
    expect(parseForgeId("src/App.tsx:0:1")).toBeNull();
    expect(parseForgeId(null)).toBeNull();
  });

  it("labels the chip with the file name and line", () => {
    expect(forgeIdLabel("src/components/Hero.tsx:12:5")).toBe("Hero.tsx:12");
    expect(forgeIdLabel(undefined)).toBeNull();
  });
});

describe("chat target", () => {
  it("always carries the route, the element only with a selection", () => {
    expect(buildChatTarget({ route: "/a-propos", selection: null, restrict: true })).toEqual({
      route: "/a-propos",
    });
    expect(
      buildChatTarget({
        route: "/",
        selection: { forgeId: "src/App.tsx:3:7" },
        restrict: true,
      }),
    ).toEqual({ route: "/", forgeId: "src/App.tsx:3:7", restrict: true });
  });

  it("drops the restriction when the toggle is off and malformed ids", () => {
    expect(buildChatTarget({ route: "/", selection: { forgeId: "src/App.tsx:3:7" }, restrict: false })).toEqual({
      route: "/",
      forgeId: "src/App.tsx:3:7",
    });
    expect(buildChatTarget({ route: "", selection: { forgeId: "nope" }, restrict: false })).toBeUndefined();
  });

  it("keeps the selection marker format unchanged", () => {
    const marker = formatElementSelectionMarker({ tag: "h1", selector: "body > h1", text: "Hi" }, "Sélection");
    expect(marker).toBe('[Sélection: h1 | selector:body > h1 | text:"Hi"]');
    expect(parseElementSelectionMarker(marker)?.tag).toBe("h1");
  });
});

describe("scope refusals", () => {
  it("collects TARGET_SCOPE paths once", () => {
    expect(
      scopeRefusedPaths([
        { code: "TARGET_SCOPE", path: "src/index.css" },
        { code: "BRAND_LOCKED", path: "DESIGN.md" },
        { code: "TARGET_SCOPE", path: "src/index.css" },
        { code: "TARGET_SCOPE", path: "src/pages/About.tsx" },
      ]),
    ).toEqual(["src/index.css", "src/pages/About.tsx"]);
  });
});
