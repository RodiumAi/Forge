import { describe, expect, it, vi } from "vitest";

import type { PromptAttachment, PromptLabels } from "@/lib/prompt-attachments";

import { emptyIntake, takePendingBrandAssets } from "./brand-intake";
import { submitBrandIntake } from "./submit";

const labels: PromptLabels = {
  importFiles: "Fichiers",
  imageAttached: "Image jointe",
  mdSection: "Fichier Markdown",
  pdfSection: "Contenu PDF",
  pdfEmpty: "PDF vide",
};

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

function attachment(f: File): PromptAttachment {
  return { source: "local", id: f.name, file: f, kind: "image", previewUrl: null };
}

describe("submitBrandIntake", () => {
  it("creates a design_system project with the logo first, the icon second and the structured prompt", async () => {
    const create = vi.fn(async () => ({ id: "p-1", name: "Nova", slug: "nova" }));
    const rasterize = vi.fn(async (f: File) => (f.name.endsWith(".svg") ? file("drawn.png", "image/png") : f));
    const project = await submitBrandIntake(
      {
        fields: {
          ...emptyIntake("fr"),
          name: "Nova",
          website: "https://nova.fr",
          logo: file("Mon Logo.svg", "image/svg+xml"),
          logoDark: file("dark.png", "image/png"),
          icon: file("icon.webp", "image/webp"),
        },
        nameFallback: "Nouveau projet",
        labels,
        locale: "fr",
        options: { designSystemId: "ds-1" },
      },
      { create, rasterize, makeAttachment: attachment },
    );

    expect(project.id).toBe("p-1");
    expect(rasterize).toHaveBeenCalledTimes(3);
    const [prompt, attachments, name, , locale, platform, options] = create.mock.calls[0] as unknown as [
      string,
      PromptAttachment[],
      string,
      PromptLabels,
      string,
      string,
      unknown,
    ];
    expect(attachments.map((a) => (a.source === "local" ? a.file.name : a.name))).toEqual([
      "brand-logo.png",
      "brand-icon.webp",
    ]);
    expect(name).toBe("Nova");
    expect(locale).toBe("fr");
    expect(platform).toBe("design_system");
    expect(options).toEqual({ designSystemId: "ds-1" });
    expect(prompt).toContain("Site web : https://nova.fr/");
    expect(prompt).toContain("« brand-icon.webp »");
    // The dark logo and the icon wait for the editor (the generation would drop them).
    const pending = takePendingBrandAssets("p-1");
    expect(pending?.logoDark?.name).toBe("dark.png");
    expect(pending?.icon?.name).toBe("brand-icon.webp");
  });

  it("keeps no icon aside when there is no main logo", async () => {
    const create = vi.fn(async () => ({ id: "p-3", name: "Nova", slug: "nova" }));
    await submitBrandIntake(
      { fields: { ...emptyIntake("en"), name: "Nova", icon: file("i.png", "image/png") }, nameFallback: "New project", labels, locale: "en" },
      { create, rasterize: async (f) => f, makeAttachment: attachment },
    );
    expect(takePendingBrandAssets("p-3")).toBeNull();
  });

  it("sends no attachment and keeps nothing aside without files", async () => {
    const create = vi.fn(async () => ({ id: "p-2", name: "Nova", slug: "nova" }));
    await submitBrandIntake(
      { fields: { ...emptyIntake("en"), name: "Nova" }, nameFallback: "New project", labels, locale: "en" },
      { create, rasterize: async (f) => f, makeAttachment: attachment },
    );
    const call = create.mock.calls[0] as unknown as [string, PromptAttachment[]];
    expect(call[1]).toEqual([]);
    expect(call[0]).toContain("Logo: none");
    expect(takePendingBrandAssets("p-2")).toBeNull();
  });

  it("does not keep the dark logo when the create fails", async () => {
    const create = vi.fn(async () => {
      throw new Error("quota");
    });
    await expect(
      submitBrandIntake(
        {
          fields: { ...emptyIntake("fr"), name: "Nova", logo: file("l.png", "image/png"), logoDark: file("d.png", "image/png") },
          nameFallback: "x",
          labels,
          locale: "fr",
        },
        { create, rasterize: async (f) => f, makeAttachment: attachment },
      ),
    ).rejects.toThrow("quota");
  });
});
