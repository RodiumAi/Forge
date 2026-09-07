import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiBase: () => "http://api.test",
  getToken: () => "session-token",
  api: vi.fn(),
}));

vi.mock("@/lib/media-token", () => ({
  getMediaToken: () => "media-token",
}));

import { api } from "@/lib/api";
import { projectThumbnailUrl, uploadProjectThumbnail } from "@/lib/project-thumbnail";

describe("projectThumbnailUrl", () => {
  it("builds an authenticated JPEG URL with cache bust", () => {
    const url = projectThumbnailUrl("proj-1", "2026-09-07T12:00:00Z");
    expect(url).toContain("http://api.test/projects/proj-1/thumbnail?");
    expect(url).toContain("access_token=media-token");
    expect(url).toContain("v=2026-09-07T12%3A00%3A00Z");
  });
});

describe("uploadProjectThumbnail", () => {
  afterEach(() => {
    vi.mocked(api).mockReset();
  });

  it("PUTs decoded JPEG bytes", async () => {
    // minimal base64 for \xff\xd8\xff
    const dataUrl = "data:image/jpeg;base64,/9j/";
    vi.mocked(api).mockResolvedValue({ ok: true, updated_at: "t1" });
    const res = await uploadProjectThumbnail("proj-1", dataUrl);
    expect(res).toEqual({ ok: true, updated_at: "t1" });
    expect(api).toHaveBeenCalledWith(
      "/projects/proj-1/thumbnail",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    const body = vi.mocked(api).mock.calls[0][1]?.body as Uint8Array;
    expect(body).toBeInstanceOf(Uint8Array);
    expect(body[0]).toBe(0xff);
    expect(body[1]).toBe(0xd8);
  });

  it("rejects non-jpeg data URLs", async () => {
    const res = await uploadProjectThumbnail("proj-1", "data:image/png;base64,aaa");
    expect(res).toEqual({ ok: false });
    expect(api).not.toHaveBeenCalled();
  });
});
