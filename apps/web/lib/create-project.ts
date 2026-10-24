import { api } from "@/lib/api";
import { refreshForgeStatus } from "@/lib/forge-status";
import { buildPromptWithAttachments, type PromptAttachment, type PromptLabels } from "@/lib/prompt-attachments";
import { uploadPromptAttachments } from "@/lib/prompt-upload";
import { clearPendingFiles, loadPendingFiles, savePendingFiles } from "@/lib/pending-files";
import { PAYLOAD_MAX_CHARS, PromptTooLongError } from "@/lib/constants/prompt";
import { normalizeKind, type ProjectKindId } from "@/lib/kinds";

export const PENDING_PROMPT_KEY = "forge_pending_prompt";
export const PENDING_TEMPLATE_KEY = "forge_pending_template";
export const PENDING_PLATFORM_KEY = "forge_pending_platform";
export const PENDING_CREATE_OPTIONS_KEY = "forge_pending_create_options";

export type ProjectPlatform = ProjectKindId;

/** Canvas ratio of a new deck (slides only). The API defaults to 16:9. */
export type DeckRatio = "16:9" | "4:3" | "1:1";
export const DECK_RATIOS: readonly DeckRatio[] = ["16:9", "4:3", "1:1"];

/**
 * Optional extras of a create, added by the Forge Design home. Both are left
 * out of the request when unset, so an older API sees the same body as before.
 */
export type CreateOptions = {
  /** Slides only; ignored for the other kinds. */
  format?: DeckRatio | null;
  /** A design_system project whose tokens dress the new project. */
  designSystemId?: string | null;
};

function isDeckRatio(raw: unknown): raw is DeckRatio {
  return typeof raw === "string" && (DECK_RATIOS as readonly string[]).includes(raw);
}

/** The extra body fields of POST /projects for these options (empty when none apply). */
export function createOptionsBody(
  platform: ProjectPlatform,
  options?: CreateOptions | null,
): { format?: DeckRatio; design_system_id?: string } {
  const body: { format?: DeckRatio; design_system_id?: string } = {};
  const format = options?.format;
  if (platform === "slides" && isDeckRatio(format)) body.format = format;
  const ds = options?.designSystemId?.trim();
  if (ds) body.design_system_id = ds;
  return body;
}

/** Keep the options across the landing to login to dashboard hop, like the platform. */
export function stashPendingCreateOptions(options: CreateOptions | null | undefined) {
  if (typeof window === "undefined") return;
  if (!options || (!options.format && !options.designSystemId)) {
    sessionStorage.removeItem(PENDING_CREATE_OPTIONS_KEY);
    return;
  }
  sessionStorage.setItem(
    PENDING_CREATE_OPTIONS_KEY,
    JSON.stringify({ format: options.format ?? null, designSystemId: options.designSystemId ?? null }),
  );
}

export function readPendingCreateOptions(): CreateOptions {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(sessionStorage.getItem(PENDING_CREATE_OPTIONS_KEY) || "null") as unknown;
    if (!raw || typeof raw !== "object") return {};
    const row = raw as { format?: unknown; designSystemId?: unknown };
    return {
      format: isDeckRatio(row.format) ? row.format : null,
      designSystemId: typeof row.designSystemId === "string" ? row.designSystemId : null,
    };
  } catch {
    return {};
  }
}

export function clearPendingCreateOptions() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_CREATE_OPTIONS_KEY);
}

export type CreatedProject = {
  id: string;
  name: string;
  slug: string;
  platform?: ProjectPlatform;
};

export type ForkableTemplate = {
  id: string;
  title: string;
  boot_hint: string;
  kind?: ProjectPlatform;
};

function normalizePlatform(raw: unknown): ProjectPlatform {
  return normalizeKind(raw);
}

export function readPendingPlatform(): ProjectPlatform {
  if (typeof window === "undefined") return "web";
  return normalizePlatform(sessionStorage.getItem(PENDING_PLATFORM_KEY));
}

export function stashPendingPlatform(platform: ProjectPlatform) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_PLATFORM_KEY, normalizePlatform(platform));
}

export function clearPendingPlatform() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_PLATFORM_KEY);
}

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

export type GenerateGate = "ok" | "no_key" | "no_rodi";

function parseRodiBalance(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Preflight before creating or forking a project.
 *
 * Forge Cloud spends FRODI through the platform gateway, not the user's API
 * key. A linked account with FRODI left can create immediately. The key and
 * the RODI wallet only matter once that credit is gone (or off Forge Cloud).
 */
export async function ensureCanGenerate(): Promise<GenerateGate> {
  try {
    const forge = await refreshForgeStatus();
    if (forge && typeof forge.frodi === "number" && forge.frodi > 0) {
      return "ok";
    }
  } catch {
    /* Fall through to the RODI / key path. */
  }

  try {
    const acc = await api<{
      has_generation_key?: boolean;
      linked?: boolean;
      wallet?: { balance_rodi?: string | null } | null;
    }>("/auth/rodium/account?fresh=1");
    if (!acc?.linked) return "ok";

    if (parseRodiBalance(acc.wallet?.balance_rodi) <= 0) return "no_rodi";

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

export type ProjectQuota = {
  used: number;
  limit: number | null; // null = unlimited
  can_create: boolean;
  plan: string | null;
};

/**
 * Preflight the plan's project cap BEFORE creating (template or prompt), so a
 * Free user at their limit sees an upgrade prompt instead of the generation
 * starting and then failing. The number comes from the plan's `max_projects`.
 */
export async function fetchProjectQuota(): Promise<ProjectQuota> {
  return api<ProjectQuota>("/projects/quota");
}

export async function createProjectFromPrompt(
  raw: string,
  nameFallback: string,
  platform: ProjectPlatform = "web",
): Promise<CreatedProject> {
  const payload = raw.trim();
  if (!payload) throw new Error("empty prompt");
  const project = await api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({
      prompt: payload,
      name: nameFallback,
      platform: normalizePlatform(platform),
    }),
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
  platform: ProjectPlatform = "web",
  options?: CreateOptions | null,
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
      platform: normalizePlatform(platform),
      ...createOptionsBody(normalizePlatform(platform), options),
    }),
  });
  const uploaded = attachments.length
    ? await uploadPromptAttachments(project.id, attachments, locale)
    : [];
  const payload = await buildPromptWithAttachments(trimmed, uploaded, labels);
  if (payload) setBootPrompt(project.id, payload);
  await clearPendingFiles();
  clearPendingPlatform();
  clearPendingCreateOptions();
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
  options?: Pick<CreateOptions, "designSystemId"> | null,
): Promise<CreatedProject> {
  // No boot prompt on purpose: the kit is a complete, working site. The boot
  // mechanism exists for prompt-created projects (it carries the USER's own
  // request); auto-firing the template's adaptation hint started a generation
  // nobody asked for the moment the project opened.
  return api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: tpl.title,
      template_id: tpl.id,
      ...createOptionsBody(normalizePlatform(tpl.kind), { designSystemId: options?.designSystemId }),
    }),
  });
}

/**
 * An empty project of a kind, no prompt and no kit: "Commencer sans modèle".
 * Sends no prompt on purpose, so no name suggestion call and no boot run.
 */
export async function createBlankProject(
  name: string,
  platform: ProjectPlatform,
  options?: CreateOptions | null,
): Promise<CreatedProject> {
  const kind = normalizePlatform(platform);
  return api<CreatedProject>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, platform: kind, ...createOptionsBody(kind, options) }),
  });
}
