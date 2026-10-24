import { describe, expect, it } from "vitest";
import { codelabSchema, type Codelab } from "@/lib/contracts/forge-design";
import { parseBlocks } from "../codelab-player";
import { editorHref } from "@/lib/kinds";
import {
  addDownload,
  addStep,
  insertBlock,
  linesOf,
  moveStep,
  removeDownload,
  removeStep,
  slugify,
  snippet,
  stepFile,
  totalMinutes,
  updateStep,
  type SnippetKind,
} from "./model";

const base: Codelab = {
  version: 1,
  title: "API REST",
  level: "beginner",
  durationMinutes: 15,
  steps: [
    { id: "intro", title: "Introduction", file: "steps/01-intro.md", minutes: 5 },
    { id: "routes", title: "Routes", file: "steps/02-routes.md", minutes: 10 },
  ],
};

describe("codelab model", () => {
  it("slugifies accents and punctuation", () => {
    expect(slugify("Créer l'API !")).toBe("creer-l-api");
    expect(slugify("   ")).toBe("etape");
    expect(stepFile(3, "Mon étape")).toBe("steps/03-mon-etape.md");
    expect(stepFile(120, "x")).toBe("steps/120-x.md");
  });

  it("adds a step after the selection with a fresh number and a unique id", () => {
    const { codelab, step } = addStep(base, "Routes", 0);
    expect(step.id).toBe("routes-2");
    expect(step.file).toBe("steps/03-routes-2.md");
    expect(codelab.steps.map((s) => s.id)).toEqual(["intro", "routes-2", "routes"]);
    expect(codelab.durationMinutes).toBe(20);
    expect(codelabSchema.safeParse(codelab).success).toBe(true);
  });

  it("removes, moves and updates steps with the total kept in sync", () => {
    expect(removeStep(base, "intro").durationMinutes).toBe(10);
    expect(moveStep(base, 1, 0).steps[0].id).toBe("routes");
    expect(moveStep(base, 0, 5)).toBe(base);
    const updated = updateStep(base, "routes", { minutes: 900, title: "  " });
    expect(updated.steps[1].minutes).toBe(600);
    expect(updated.steps[1].title).toBeUndefined();
    expect(totalMinutes(updated)).toBe(605);
  });

  it("declares downloads once and removes them", () => {
    const first = addDownload(base, "files/starter", true);
    expect(first.id).toBe("starter");
    expect(first.codelab.downloads?.[0]).toEqual({ id: "starter", label: "starter.zip", path: "files/starter", zip: true });
    expect(addDownload(first.codelab, "files/starter", true).codelab).toBe(first.codelab);
    const second = addDownload(first.codelab, "files/solution/main.py", false);
    expect(second.id).toBe("main");
    expect(codelabSchema.safeParse(second.codelab).success).toBe(true);
    expect(removeDownload(removeDownload(second.codelab, "starter"), "main").downloads).toBeUndefined();
  });

  it("reads one entry per line", () => {
    expect(linesOf(" a \n\n b ")).toEqual(["a", "b"]);
    expect(linesOf("  ")).toBeUndefined();
  });

  it("toolbar snippets parse as the intended block", () => {
    const expected: Record<SnippetKind, string> = {
      code: "code",
      diff: "code",
      terminal: "terminal",
      tabs: "tabs",
      callout: "callout",
      image: "markdown",
      download: "download",
      tree: "tree",
    };
    for (const [kind, type] of Object.entries(expected)) {
      const blocks = parseBlocks(snippet(kind as SnippetKind));
      expect(blocks[0]?.type, kind).toBe(type);
    }
    expect(snippet("terminal", "npm test")).toContain("$ npm test");
    expect(snippet("download", "starter")).toBe("```download\nstarter\n```\n");
  });

  it("inserts a block on its own lines and returns the caret", () => {
    const value = "# Titre\nTexte";
    const res = insertBlock(value, value.length, value.length, "B\n");
    expect(res.value).toBe("# Titre\nTexte\n\nB\n");
    expect(res.caret).toBe(res.value.length);
    const mid = insertBlock("ab", 1, 1, "X\n");
    expect(mid.value).toBe("a\n\nX\n\nb");
  });

  it("routes codelab projects to their editor", () => {
    expect(editorHref("p1", "codelab")).toBe("/projects/p1/codelab");
    expect(editorHref("p1", "slides")).toBe("/projects/p1/deck");
    expect(editorHref("p1", "web")).toBe("/projects/p1");
  });
});
