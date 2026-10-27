import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));
vi.mock("@/lib/pending-files", () => ({
  clearPendingFiles: vi.fn(async () => undefined),
  loadPendingFiles: vi.fn(async () => []),
  savePendingFiles: vi.fn(async () => undefined),
}));

import {
  createBlankProject,
  createOptionsBody,
  createProjectWithAttachments,
  forkProjectFromTemplate,
  readPendingCreateOptions,
  stashPendingCreateOptions,
} from "@/lib/create-project";
import type { PromptLabels } from "@/lib/prompt-attachments";

const LABELS = {} as PromptLabels;

function lastBody(): Record<string, unknown> {
  const [, init] = apiMock.mock.calls.at(-1) as [string, { body: string }];
  return JSON.parse(init.body);
}

describe("create options", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ id: "p1", name: "P", slug: "p" });
    sessionStorage.clear();
  });

  it("keeps the old body when no option is set", async () => {
    await createProjectWithAttachments("Un site", [], "Nouveau projet", LABELS, "fr", "web");
    expect(lastBody()).toEqual({ prompt: "Un site", name: "Nouveau projet", platform: "web" });
  });

  it("sends format and design system for a deck", async () => {
    await createProjectWithAttachments("Un deck", [], "Nouveau projet", LABELS, "fr", "slides", {
      format: "1:1",
      designSystemId: "ds-1",
    });
    expect(lastBody()).toEqual({
      prompt: "Un deck",
      name: "Nouveau projet",
      platform: "slides",
      format: "1:1",
      design_system_id: "ds-1",
    });
  });

  it("drops the format of a kind that has none", () => {
    expect(createOptionsBody("web", { format: "1:1" })).toEqual({});
    expect(createOptionsBody("codelab", { format: "16:9", designSystemId: "ds" })).toEqual({
      design_system_id: "ds",
    });
  });

  it("a blank project sends no prompt", async () => {
    await createBlankProject("Nouveau projet", "slides", { format: "16:9" });
    expect(lastBody()).toEqual({ name: "Nouveau projet", platform: "slides", format: "16:9" });
  });

  it("a template fork can carry a design system", async () => {
    await forkProjectFromTemplate({ id: "kit", title: "Kit", boot_hint: "", kind: "web" }, { designSystemId: "ds-2" });
    expect(lastBody()).toEqual({ name: "Kit", template_id: "kit", design_system_id: "ds-2" });
    await forkProjectFromTemplate({ id: "kit", title: "Kit", boot_hint: "" });
    expect(lastBody()).toEqual({ name: "Kit", template_id: "kit" });
  });

  it("stashes the options across the login hop", () => {
    stashPendingCreateOptions({ format: "1:1", designSystemId: "ds" });
    expect(readPendingCreateOptions()).toEqual({ format: "1:1", designSystemId: "ds" });
    stashPendingCreateOptions(null);
    expect(readPendingCreateOptions()).toEqual({});
  });
});
