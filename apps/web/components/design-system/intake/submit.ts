import {
  createProjectWithAttachments,
  type CreateOptions,
  type CreatedProject,
} from "@/lib/create-project";
import { createPromptAttachment, type PromptAttachment, type PromptLabels } from "@/lib/prompt-attachments";

import {
  ATTACHMENT_NAMES,
  buildIntakePrompt,
  isSvgFile,
  setPendingBrandAssets,
  type IntakeFields,
} from "./brand-intake";

/** Longest side of an SVG logo once drawn as a PNG. */
const RASTER_SIZE = 1024;

/**
 * An SVG drawn into a PNG: chat attachments and the logo endpoint only take
 * raster images (an SVG can carry script). Any other file is returned as is.
 */
export async function rasterizeLogo(file: File, size = RASTER_SIZE): Promise<File> {
  if (!isSvgFile(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("svg"));
      img.src = url;
    });
    const w = image.naturalWidth || size;
    const h = image.naturalHeight || size;
    const scale = size / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("png");
    return new File([blob], file.name.replace(/\.svg$/i, "") + ".png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function extensionOf(file: File): string {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

/** The same bytes under a stable name (`brand-logo.png`), so the prompt can point at it. */
function renamed(file: File, base: string): File {
  return new File([file], `${base}.${extensionOf(file)}`, { type: file.type || "image/png" });
}

export type IntakeSubmitDeps = {
  create?: typeof createProjectWithAttachments;
  rasterize?: (file: File) => Promise<File>;
  makeAttachment?: (file: File) => PromptAttachment | null;
};

export type IntakeSubmitArgs = {
  fields: IntakeFields;
  nameFallback: string;
  labels: PromptLabels;
  locale: string;
  options?: CreateOptions | null;
};

/**
 * Creates the design system project from the intake: the main logo as the
 * first image attachment (the AI reads it as the logo), the square icon as a
 * second one, the structured prompt as the boot prompt, and the dark logo
 * kept aside for the editor (see `setPendingBrandAssets`).
 */
export async function submitBrandIntake(args: IntakeSubmitArgs, deps: IntakeSubmitDeps = {}): Promise<CreatedProject> {
  const create = deps.create ?? createProjectWithAttachments;
  const rasterize = deps.rasterize ?? rasterizeLogo;
  const makeAttachment = deps.makeAttachment ?? createPromptAttachment;
  const { fields } = args;

  const attachments: PromptAttachment[] = [];
  let iconName: string | null = null;
  let iconFile: File | null = null;
  if (fields.logo) {
    const item = makeAttachment(renamed(await rasterize(fields.logo), ATTACHMENT_NAMES.logo));
    if (item) attachments.push(item);
  }
  if (fields.icon) {
    const file = renamed(await rasterize(fields.icon), ATTACHMENT_NAMES.icon);
    iconFile = file;
    const item = makeAttachment(file);
    if (item) {
      attachments.push(item);
      iconName = file.name;
    }
  }
  const darkLogo = fields.logo && fields.logoDark ? await rasterize(fields.logoDark) : null;

  const prompt = buildIntakePrompt(fields, iconName);
  const project = await create(
    prompt,
    attachments,
    fields.name.trim() || args.nameFallback,
    args.labels,
    args.locale,
    "design_system",
    args.options,
  );
  // The icon endpoint needs a main logo; with no logo the AI builds one from the attached icon.
  setPendingBrandAssets(project.id, { logoDark: darkLogo ?? undefined, icon: fields.logo ? (iconFile ?? undefined) : undefined });
  return project;
}
