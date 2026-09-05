import { describe, expect, it } from "vitest";

import {
  buildAmbiguousEditPrompt,
  extractCandidatePaths,
} from "@/lib/visual-edit-chat";

describe("extractCandidatePaths", () => {
  it("pulls trailing source paths from the API detail", () => {
    const detail =
      "Ce texte apparaît à plusieurs endroits — demandez à Forge dans le chat de le modifier. — This text appears once in several files. src/components/Footer.tsx, src/components/Hero.tsx";
    expect(extractCandidatePaths(detail)).toEqual([
      "src/components/Footer.tsx",
      "src/components/Hero.tsx",
    ]);
  });

  it("tolerates a (+N) suffix", () => {
    expect(
      extractCandidatePaths("Ambiguous. a.tsx, b.tsx, c.tsx (+2)"),
    ).toEqual(["a.tsx", "b.tsx", "c.tsx"]);
  });
});

describe("buildAmbiguousEditPrompt", () => {
  it("fills old/new and optional files clause", () => {
    const prompt = buildAmbiguousEditPrompt("Hello", "Bonjour", ["src/Hero.tsx"], {
      template:
        "Change « {old} » to « {new} » everywhere{filesClause}.",
      filesClause: " (especially in {files})",
    });
    expect(prompt).toBe(
      "Change « Hello » to « Bonjour » everywhere (especially in src/Hero.tsx).",
    );
  });
});
