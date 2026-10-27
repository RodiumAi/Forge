import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();
const uploadMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));
vi.mock("@/lib/prompt-upload", () => ({
  uploadPromptAttachments: (...args: unknown[]) => uploadMock(...args),
}));
vi.mock("@/lib/pending-files", () => ({
  clearPendingFiles: vi.fn(async () => undefined),
  loadPendingFiles: vi.fn(async () => []),
  savePendingFiles: vi.fn(async () => undefined),
}));

import { createProjectWithAttachments } from "@/lib/create-project";
import type { PromptAttachment, PromptLabels } from "@/lib/prompt-attachments";

const LABELS = {} as PromptLabels;
const LOGO = {
  id: "a1",
  kind: "image",
  source: "local",
  file: new File(["x"], "logo.png", { type: "image/png" }),
} as unknown as PromptAttachment;

describe("createProjectWithAttachments when the upload fails", () => {
  beforeEach(() => {
    apiMock.mockReset();
    uploadMock.mockReset();
    apiMock.mockResolvedValue({ id: "p1", name: "P", slug: "p" });
  });

  it("deletes the empty project and reports the upload error", async () => {
    uploadMock.mockRejectedValue(new Error("Impossible d'envoyer le fichier."));
    await expect(createProjectWithAttachments("Une landing", [LOGO], "Nouveau projet", LABELS, "fr")).rejects.toThrow(
      "Impossible d'envoyer le fichier.",
    );
    expect(apiMock).toHaveBeenLastCalledWith("/projects/p1", { method: "DELETE" });
  });

  it("keeps the project when the upload works", async () => {
    uploadMock.mockResolvedValue([LOGO]);
    await createProjectWithAttachments("Une landing", [LOGO], "Nouveau projet", LABELS, "fr");
    expect(apiMock).not.toHaveBeenCalledWith("/projects/p1", { method: "DELETE" });
  });
});
