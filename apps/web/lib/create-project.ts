import { api } from "@/lib/api";
import { buildPromptWithAttachments, type PromptAttachment, type PromptLabels } from "@/lib/prompt-attachments";
import { uploadPromptAttachments } from "@/lib/prompt-upload";
import { clearPendingFiles, loadPendingFiles, savePendingFiles } from "@/lib/pending-files";

export const PENDING_PROMPT_KEY = "forge_pending_prompt";
export const PENDING_TEMPLATE_KEY = "forge_pending_template";

export type CreatedProject = {
  id: string;
  name: string;
  slug: string;
};

export type ForkableTemplate = {
  id: string;
  title: string;
  boot_hint: string;
};

export function bootPromptKey(projectId: string): string {
  return `forge_boot_prompt_${projectId}`;
}

export function setBootPrompt(projectId: string, prompt: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(bootPromptKey(projectId), prompt);
}

export function peekBootPrompt(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(bootPromptKey(projectId));
}

export function clearBootPrompt(projectId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(bootPromptKey(projectId));
}

/** Ensure a generation key exists — auto-picks first active account key when unset. */
export async function ensureCanGenerate(): Promise<"ok" | "no_key"> {
  try {
    const acc = await api<{
      has_generation_key?: boolean;
      linked?: boolean;
    }>("/auth/rodium/account");
    if (!acc?.linked) return "ok";
    if (acc.has_generation_key === true) return "ok";

    const ensured = await api<{ has_generation_key?: boolean }>(
      "/auth/rodium/ensure-generation-key",
      { method: "POST" },
    );
    return ensured?.has_generation_key ? "ok" : "no_key";
  } catch {
    return "no_key";
  }
}

export async function createProjectFromPrompt(
  raw: string,
  nameFallback: string,
): Promise<CreatedProject> {
  const payload = raw.trim();
  if (!payload) throw new Error("empty prompt");
  // API may auto-fork a ThemeWagon kit when the prompt matches (hybrid start).
  const project = await api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({ prompt: payload, name: nameFallback }),
  });
  setBootPrompt(project.id, payload);
  return project;
}

export async function createProjectWithAttachments(
  text: string,
  attachments: PromptAttachment[],
  nameFallback: string,
  labels: PromptLabels,
  locale: string,
): Promise<CreatedProject> {
  const trimmed = text.trim();
  const project = await api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({
      prompt: trimmed || nameFallback,
      name: nameFallback,
    }),
  });
  const uploaded = attachments.length
    ? await uploadPromptAttachments(project.id, attachments, locale)
    : [];
  const payload = await buildPromptWithAttachments(trimmed, uploaded, labels);
  if (payload) setBootPrompt(project.id, payload);
  await clearPendingFiles();
  return project;
}

export async function restorePendingFilesAsAttachments(): Promise<File[]> {
  return loadPendingFiles();
}

export async function stashPendingFiles(files: File[]): Promise<void> {
  const locals = files.filter((f) => f instanceof File);
  if (locals.length) await savePendingFiles(locals);
}

export async function forkProjectFromTemplate(
  tpl: ForkableTemplate,
): Promise<CreatedProject> {
  const project = await api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({ name: tpl.title, template_id: tpl.id }),
  });
  const hint = tpl.boot_hint?.trim();
  if (hint) setBootPrompt(project.id, hint);
  return project;
}
