import { api } from "@/lib/api";

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
  const project = await api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({ prompt: payload, name: nameFallback }),
  });
  setBootPrompt(project.id, payload);
  return project;
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
