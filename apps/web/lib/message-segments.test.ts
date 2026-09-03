import { describe, expect, it } from "vitest";
import { languageForPath, splitMessageSegments } from "./message-segments";

describe("prose only", () => {
  it("returns a single text segment", () => {
    expect(splitMessageSegments("Voici le plan.")).toEqual([
      { kind: "text", content: "Voici le plan." },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(splitMessageSegments("")).toEqual([]);
    expect(splitMessageSegments("   \n\n ")).toEqual([]);
  });

  it("collapses excessive blank lines", () => {
    expect(splitMessageSegments("a\n\n\n\n\nb")[0]).toEqual({ kind: "text", content: "a\n\nb" });
  });
});

describe("write blocks", () => {
  it("extracts a file write and keeps the surrounding prose", () => {
    const raw = 'Intro\n<forge-write path="src/App.tsx">const a = 1;</forge-write>\nOutro';
    expect(splitMessageSegments(raw)).toEqual([
      { kind: "text", content: "Intro" },
      { kind: "write", path: "src/App.tsx", content: "const a = 1;", complete: true },
      { kind: "text", content: "Outro" },
    ]);
  });

  it("never leaks the raw tag as text", () => {
    const raw = '<forge-write path="a.css">body{}</forge-write>';
    const text = splitMessageSegments(raw)
      .filter((s) => s.kind === "text")
      .map((s) => (s as { content: string }).content)
      .join("");
    expect(text).not.toContain("forge-write");
  });

  it("handles several writes in one message", () => {
    const raw =
      '<forge-write path="a.tsx">A</forge-write><forge-write path="b.tsx">B</forge-write>';
    expect(splitMessageSegments(raw).map((s) => s.kind)).toEqual(["write", "write"]);
  });

  it("strips markdown fences the model wraps bodies in", () => {
    const raw = '<forge-write path="a.css">```css\nbody{}\n```</forge-write>';
    expect((splitMessageSegments(raw)[0] as { content: string }).content).toBe("body{}");
  });

  it("accepts single quotes around the path", () => {
    const raw = "<forge-write path='src/a.ts'>x</forge-write>";
    expect((splitMessageSegments(raw)[0] as { path: string }).path).toBe("src/a.ts");
  });

  it("normalises a leading ./ in the path", () => {
    const raw = '<forge-write path="./src/a.ts">x</forge-write>';
    expect((splitMessageSegments(raw)[0] as { path: string }).path).toBe("src/a.ts");
  });

  it("preserves indentation inside the body", () => {
    const raw = '<forge-write path="a.ts">function f() {\n  return 1;\n}</forge-write>';
    expect((splitMessageSegments(raw)[0] as { content: string }).content).toContain("\n  return 1;");
  });
});

describe("streaming", () => {
  it("marks an unterminated write as incomplete", () => {
    // This is the case that used to dump raw CSS into the chat.
    const raw = 'Je mets a jour\n<forge-write path="src/index.css">:root { --bg: #000;';
    const segments = splitMessageSegments(raw);
    expect(segments[0]).toEqual({ kind: "text", content: "Je mets a jour" });
    expect(segments[1]).toMatchObject({
      kind: "write",
      path: "src/index.css",
      complete: false,
    });
  });

  it("does not emit a write until the path attribute is complete", () => {
    const segments = splitMessageSegments('Texte\n<forge-write path="src/');
    expect(segments.every((s) => s.kind === "text")).toBe(true);
  });

  it("never leaks a partial opening tag into the prose", () => {
    for (const tail of ["<forge", "<forge-write", '<forge-write path="src/App.tsx', "</forge-write"]) {
      const segments = splitMessageSegments(`Voici la suite\n${tail}`);
      expect(segments).toEqual([{ kind: "text", content: "Voici la suite" }]);
    }
    // A real "<" in prose is untouched.
    expect(splitMessageSegments("a < b")).toEqual([{ kind: "text", content: "a < b" }]);
  });

  it("flips to complete once the closing tag arrives", () => {
    const open = splitMessageSegments('<forge-write path="a.ts">x');
    const closed = splitMessageSegments('<forge-write path="a.ts">x</forge-write>');
    expect((open[0] as { complete: boolean }).complete).toBe(false);
    expect((closed[0] as { complete: boolean }).complete).toBe(true);
  });
});

describe("delete tags", () => {
  it("extracts a self-closing delete", () => {
    const raw = 'Nettoyage\n<forge-delete path="src/Old.tsx" />';
    expect(splitMessageSegments(raw)).toEqual([
      { kind: "text", content: "Nettoyage" },
      { kind: "delete", path: "src/Old.tsx" },
    ]);
  });

  it("keeps writes and deletes in source order", () => {
    const raw =
      '<forge-delete path="a.ts" /><forge-write path="b.ts">B</forge-write><forge-delete path="c.ts" />';
    expect(splitMessageSegments(raw).map((s) => s.kind)).toEqual(["delete", "write", "delete"]);
  });
});

describe("languageForPath", () => {
  it("maps known extensions", () => {
    expect(languageForPath("src/App.tsx")).toBe("tsx");
    expect(languageForPath("a/b.css")).toBe("css");
    expect(languageForPath("x.json")).toBe("json");
  });

  it("returns an empty hint for unknown extensions", () => {
    expect(languageForPath("LICENSE")).toBe("");
    expect(languageForPath("a.weird")).toBe("");
  });
});
