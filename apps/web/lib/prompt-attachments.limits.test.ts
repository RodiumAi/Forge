import { describe, expect, it } from "vitest";

import {
  MAX_PROMPT_FILE_BYTES,
  PROMPT_FILE_ACCEPT,
  createPromptAttachment,
  mergePromptAttachments,
  promptAttachmentKind,
} from "@/lib/prompt-attachments";

function file(name: string, type: string, size = 10): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("prompt attachment limits", () => {
  it("accepts images and Markdown only", () => {
    expect(promptAttachmentKind(file("maquette.png", "image/png"))).toBe("image");
    expect(promptAttachmentKind(file("brief.md", ""))).toBe("md");
    expect(promptAttachmentKind(file("maquette.pdf", "application/pdf"))).toBeNull();
    expect(promptAttachmentKind(file("notes.txt", "text/plain"))).toBeNull();
    expect(PROMPT_FILE_ACCEPT).not.toMatch(/pdf|txt|text\/plain/);
  });

  it("rejects files over 6 MB", () => {
    const big = file("ecran.png", "image/png", MAX_PROMPT_FILE_BYTES + 1);
    expect(createPromptAttachment(big)).toBeNull();
    const result = mergePromptAttachments([], [big, file("ok.png", "image/png", MAX_PROMPT_FILE_BYTES)]);
    expect(result.tooLarge).toEqual(["ecran.png"]);
    expect(result.next.map((a) => (a.source === "local" ? a.file.name : a.name))).toEqual(["ok.png"]);
  });

  it("reports a PDF as a wrong type, not as too large", () => {
    const result = mergePromptAttachments([], [file("maquette.pdf", "application/pdf", 11 * 1024 * 1024)]);
    expect(result.rejected).toEqual(["maquette.pdf"]);
    expect(result.tooLarge).toEqual([]);
    expect(result.next).toEqual([]);
  });
});
