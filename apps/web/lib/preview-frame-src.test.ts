import { describe, expect, it } from "vitest";
import { sanitizePreviewFrameSrc } from "./preview-frame-src";

describe("sanitizePreviewFrameSrc", () => {
  const api = "https://api-forge.rodiumai.io";
  const id = "0f778b04-961c-4940-9ce7-dc8ea14a0efd";

  it("allows Forge API draft URLs", () => {
    const src = `${api}/projects/${id}/draft?access_token=abc`;
    expect(sanitizePreviewFrameSrc(src, api)).toBe(src);
  });

  it("rejects external hosts", () => {
    expect(
      sanitizePreviewFrameSrc(`https://evil.example/projects/${id}/draft`, api),
    ).toBeNull();
  });

  it("rejects javascript: and non-draft paths", () => {
    expect(sanitizePreviewFrameSrc("javascript:alert(1)", api)).toBeNull();
    expect(sanitizePreviewFrameSrc(`${api}/projects/${id}/files`, api)).toBeNull();
  });
});
