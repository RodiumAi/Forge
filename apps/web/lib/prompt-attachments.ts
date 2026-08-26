export const MAX_PROMPT_FILES = 5;

export const PROMPT_FILE_ACCEPT =
  ".md,.markdown,.txt,.pdf,image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.ico,image/x-icon,image/vnd.microsoft.icon,text/markdown,text/plain,application/pdf";

export type PromptAttachmentKind = "image" | "md" | "pdf" | "txt";

export type LocalPromptAttachment = {
  source: "local";
  id: string;
  file: File;
  kind: PromptAttachmentKind;
  previewUrl: string | null;
  publicUrl?: string | null;
  objectId?: string | null;
  /** @deprecated use publicUrl */
  publicPath?: string | null;
};

export type ProjectRefPromptAttachment = {
  source: "project";
  id: string;
  kind: PromptAttachmentKind;
  name: string;
  publicUrl: string;
  objectId?: string | null;
  previewUrl?: string | null;
  /** @deprecated use publicUrl */
  publicPath?: string | null;
};

export type PromptAttachment = LocalPromptAttachment | ProjectRefPromptAttachment;

export type MessageAttachment = {
  name: string;
  kind: PromptAttachmentKind | string;
  previewUrl?: string | null;
  publicUrl?: string | null;
  objectId?: string | null;
  /** @deprecated use publicUrl */
  publicPath?: string | null;
};

const EXPLICIT_ASSET_USE_RE =
  /\b(?:use|set|put|place|attach|insert|comme|met(?:s|tre)|utilis(?:e|er))\b[\s\S]{0,40}\b(?:as|pour|for|en)?\s*(?:the|la|le|this|cette|cet|mon|my)?\s*(?:logo|favicon|icône|icone|bannière|banner|marque|brand)\b/i;

/** Filename looks like a logo/favicon file the user wants embedded in the site. */
const ASSET_FILENAME_RE =
  /(?:^|[/_.-])(?:logo|favicon|icon|icone|icône|brand|marque|banner|bannière)(?:[._-]|\.[a-z0-9]+$)/i;

/** Filename looks like a design reference capture — never treat as embeddable asset. */
const REFERENCE_FILENAME_RE =
  /(?:screenshot|screen-?shot|capture|mockup|maquette|wireframe|reference|référence|ref-?design|design-?ref)/i;

const ATTACH_INSTRUCTION_RE =
  /This is an? (?:REFERENCE screenshot(?:\/mockup)?(?: for visual inspiration)?|uploaded site asset)[\s\S]*?(?=\n\n|\Z)/gi;

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function attachmentName(item: PromptAttachment): string {
  return item.source === "local" ? item.file.name : item.name;
}

export function attachmentObjectId(item: PromptAttachment): string | null {
  return item.objectId || null;
}

export function attachmentPreviewUrl(item: PromptAttachment): string | null {
  if (item.previewUrl) return item.previewUrl;
  if (item.source === "local") return item.previewUrl;
  return item.publicUrl || null;
}

export function attachmentPublicUrl(item: PromptAttachment): string | null {
  if (item.source === "local") return item.publicUrl || item.publicPath || null;
  return item.publicUrl || item.publicPath || null;
}

export function promptAttachmentKind(file: File): PromptAttachmentKind | null {
  const ext = extensionOf(file.name);
  const type = (file.type || "").toLowerCase();
  const imageExt = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "ico",
    "bmp",
    "jfif",
    "pjpeg",
    "avif",
    "heic",
    "heif",
    "tif",
    "tiff",
  ];

  if (type.startsWith("image/") || type === "image/x-icon" || type === "image/vnd.microsoft.icon" || imageExt.includes(ext)) {
    return "image";
  }
  if (type === "text/markdown" || type === "text/x-markdown" || ext === "md" || ext === "markdown") {
    return "md";
  }
  if (type === "text/plain" || ext === "txt") {
    return "txt";
  }
  if (type === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  return null;
}

export function createPromptAttachment(file: File): LocalPromptAttachment | null {
  const kind = promptAttachmentKind(file);
  if (!kind) return null;
  return {
    source: "local",
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
  };
}

export function createProjectRefAttachment(asset: {
  id: string;
  name: string;
  public_url: string;
  content_type?: string;
}): ProjectRefPromptAttachment {
  const ext = extensionOf(asset.name);
  const kind: PromptAttachmentKind =
    asset.content_type?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
      ? "image"
      : ext === "pdf"
        ? "pdf"
        : ext === "md" || ext === "markdown"
          ? "md"
          : "txt";
  return {
    source: "project",
    id: `ref-${asset.id}`,
    kind,
    name: asset.name,
    publicUrl: asset.public_url,
    objectId: asset.id,
    previewUrl: null,
    publicPath: asset.public_url,
  };
}

export function revokePromptAttachment(item: PromptAttachment) {
  if (item.source === "local" && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

export function mergePromptAttachments(
  prev: PromptAttachment[],
  incoming: FileList | File[],
  max = MAX_PROMPT_FILES,
): { next: PromptAttachment[]; rejected: string[] } {
  const next = [...prev];
  const rejected: string[] = [];
  for (const file of Array.from(incoming)) {
    if (next.length >= max) break;
    const kind = promptAttachmentKind(file);
    if (!kind) {
      rejected.push(file.name);
      continue;
    }
    const created = createPromptAttachment(file);
    if (created) next.push(created);
  }
  return { next, rejected };
}

async function readTextFile(file: File): Promise<string> {
  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const parts: string[] = [];

  const parenRe = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = parenRe.exec(raw))) {
    const inner = match[0].slice(1, match[0].lastIndexOf(")"));
    parts.push(unescapePdfString(inner));
  }

  const arrayRe = /\[([\s\S]*?)\]\s*TJ/g;
  while ((match = arrayRe.exec(raw))) {
    const body = match[1];
    const strRe = /\((?:\\.|[^\\()])*\)/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(body))) {
      parts.push(unescapePdfString(s[0].slice(1, -1)));
    }
  }

  const cleaned = parts.join(" ").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 20) return cleaned.slice(0, 40_000);

  const runs = raw.match(/[\x20-\x7EÀ-ÿ]{5,}/g) || [];
  return runs.join(" ").replace(/\s+/g, " ").trim().slice(0, 40_000);
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

export type PromptLabels = {
  importFiles: string;
  imageAttached: string;
  mdSection: string;
  pdfSection: string;
  pdfEmpty: string;
  txtSection?: string;
};

export const ATTACH_IMAGE_RE =
  /\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe):\s*([^\]]+)\]/gi;
export const ATTACH_FILES_RE = /\[(?:Files|Fichiers):\s*([^\]]+)\]/gi;
export const ATTACH_DOC_RE =
  /###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte|PDF attached[^:]*):\s*([^\n]+)\n+/gi;
export const ATTACH_PUBLIC_HINT_RE = /—\s*saved in project as\s*`([^`]+)`/gi;

function parseImageMarkerBody(body: string): {
  name: string;
  url: string | null;
  objectId: string | null;
} {
  const parts = body.split("|").map((p) => p.trim()).filter(Boolean);
  let name = parts[0] || "";
  let url: string | null = null;
  let objectId: string | null = null;
  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (lower.startsWith("url:")) url = part.slice(4).trim() || null;
    else if (lower.startsWith("public:")) url = part.slice(7).trim() || null;
    else if (lower.startsWith("object:")) objectId = part.slice(7).trim() || null;
  }
  return { name, url, objectId };
}

function isAssetIntent(prompt: string, images: PromptAttachment[]): boolean {
  if (images.some((img) => REFERENCE_FILENAME_RE.test(attachmentName(img)))) {
    return false;
  }
  if (EXPLICIT_ASSET_USE_RE.test(prompt)) return true;
  return images.some((img) => ASSET_FILENAME_RE.test(attachmentName(img)));
}

export function parseUserMessageContent(raw: string): {
  text: string;
  attachments: MessageAttachment[];
} {
  const attachments: MessageAttachment[] = [];
  let text = raw || "";

  for (const match of raw.matchAll(ATTACH_IMAGE_RE)) {
    const { name, url, objectId } = parseImageMarkerBody(match[1] || "");
    if (!name) continue;
    const existing = attachments.find((a) => a.name === name);
    if (existing) {
      if (url && !existing.publicUrl) {
        existing.publicUrl = url;
        existing.publicPath = url;
      }
      if (objectId && !existing.objectId) existing.objectId = objectId;
    } else {
      attachments.push({
        name,
        kind: "image",
        publicUrl: url,
        publicPath: url,
        objectId,
      });
    }
  }

  for (const match of raw.matchAll(ATTACH_FILES_RE)) {
    for (const part of match[1].split(",")) {
      const name = part.trim();
      if (!name) continue;
      const ext = extensionOf(name);
      const kind =
        ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
          ? "image"
          : ext === "pdf"
            ? "pdf"
            : ext === "md" || ext === "markdown"
              ? "md"
              : "txt";
      if (!attachments.some((a) => a.name === name)) {
        attachments.push({ name, kind });
      }
    }
  }

  for (const match of raw.matchAll(ATTACH_DOC_RE)) {
    const name = match[1].trim();
    if (!name) continue;
    const ext = extensionOf(name);
    const kind = ext === "pdf" ? "pdf" : ext === "txt" ? "txt" : "md";
    if (!attachments.some((a) => a.name === name)) {
      attachments.push({ name, kind });
    }
  }

  text = text
    .replace(ATTACH_IMAGE_RE, "")
    .replace(ATTACH_FILES_RE, "")
    .replace(ATTACH_PUBLIC_HINT_RE, "")
    .replace(ATTACH_INSTRUCTION_RE, "")
    // Legacy prose instructions (older messages) + selection markers stay out of the UI.
    .replace(/\[(?:Sélection|Selection):\s*[^\]]*\]/gi, "")
    .replace(/\[Connector:\s*[^\]]+\]/gi, "")
    .replace(/###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte)[^\n]*\n+[\s\S]*?(?=\n###|\n\[|\s*$)/gi, "")
    .replace(/\[(?:PDF attached|PDF joint)[^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, attachments };
}

export async function buildPromptWithAttachments(
  prompt: string,
  attachments: PromptAttachment[],
  labels: PromptLabels,
): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed && attachments.length === 0) return "";

  const chunks: string[] = [];
  if (trimmed) chunks.push(trimmed);

  const images = attachments.filter((a) => a.kind === "image");
  const docs = attachments.filter((a) => a.kind === "md" || a.kind === "pdf" || a.kind === "txt");
  const assetMode = isAssetIntent(trimmed, images);

  if (images.length) {
    // Structured markers only — vision/asset instructions are injected server-side
    // so they never appear in the chat UI.
    chunks.push(`[${labels.importFiles}: ${images.map(attachmentName).join(", ")}]`);
    for (const img of images) {
      const url = attachmentPublicUrl(img);
      const objectId = attachmentObjectId(img);
      const urlPart = url ? ` | url:${url}` : "";
      const objectPart = objectId ? ` | object:${objectId}` : "";
      const intentPart = ` | intent:${assetMode ? "asset" : "reference"}`;
      const name = attachmentName(img);
      chunks.push(`[${labels.imageAttached}: ${name}${urlPart}${objectPart}${intentPart}]`);
    }
  }

  for (const doc of docs) {
    if (doc.source !== "local") continue;
    try {
      if (doc.kind === "md" || doc.kind === "txt") {
        const text = (await readTextFile(doc.file)).trim();
        const section = doc.kind === "txt" ? labels.txtSection || labels.mdSection : labels.mdSection;
        chunks.push(`### ${section}: ${doc.file.name}\n\n${text}`);
      } else {
        const text = (await extractPdfText(doc.file)).trim();
        if (text) {
          chunks.push(`### ${labels.pdfSection}: ${doc.file.name}\n\n${text}`);
        } else {
          chunks.push(`[${labels.pdfEmpty}: ${doc.file.name}]`);
        }
      }
    } catch {
      chunks.push(`[${labels.importFiles}: ${doc.file.name}]`);
    }
  }

  return chunks.join("\n\n").trim();
}

export function insertMentionInTextarea(
  textarea: HTMLTextAreaElement | null,
  value: string,
  mention: string,
): string {
  if (!textarea) return `${value}${mention}`;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const before = value.slice(0, start).replace(/@(?:[^\s@]*)$/, "");
  const after = value.slice(end);
  return `${before}${mention} ${after}`.replace(/\s+/g, " ").trimStart();
}

export type ElementSelectionMarker = {
  tag: string;
  id?: string | null;
  className?: string | null;
  selector: string;
  text?: string;
};

export function formatElementSelectionMarker(sel: ElementSelectionMarker, label = "Sélection"): string {
  const parts = [
    sel.tag || "element",
    sel.selector ? `selector:${sel.selector}` : "",
    sel.text ? `text:"${sel.text.replace(/"/g, "'").slice(0, 80)}"` : "",
  ].filter(Boolean);
  return `[${label}: ${parts.join(" | ")}]`;
}
