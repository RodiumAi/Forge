import { api } from "@/lib/api";
import { buildPromptWithAttachments, type PromptAttachment, type PromptLabels } from "@/lib/prompt-attachments";
import { uploadPromptAttachments } from "@/lib/prompt-upload";
import { clearPendingFiles, loadPendingFiles, savePendingFiles } from "@/lib/pending-files";
import { PAYLOAD_MAX_CHARS, PromptTooLongError } from "@/lib/constants/prompt";

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
  // Preflight the assembled size BEFORE creating the project. Inlined doc text
  // (md/txt/pdf) dominates the payload and is read from local files here, so we
  // can measure it up front and fail cleanly instead of leaving an empty orphan
  // project behind. The only thing missing at this point is image public URLs
  // (a few hundred chars), well within the margin below the API's 50k cap.
  const preview = await buildPromptWithAttachments(trimmed, attachments, labels);
  if (preview.length > PAYLOAD_MAX_CHARS) throw new PromptTooLongError();

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
  // No boot prompt on purpose: the kit is a complete, working site. The boot
  // mechanism exists for prompt-created projects (it carries the USER's own
  // request); auto-firing the template's adaptation hint started a generation
  // nobody asked for the moment the project opened.
  return api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({ name: tpl.title, template_id: tpl.id }),
  });
}
