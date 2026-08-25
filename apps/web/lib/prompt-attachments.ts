export const MAX_PROMPT_FILES = 5;

export const PROMPT_FILE_ACCEPT =
  ".md,.markdown,.txt,.pdf,image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,text/markdown,text/plain,application/pdf";

export type PromptAttachmentKind = "image" | "md" | "pdf" | "txt";

export type PromptAttachment = {
  id: string;
  file: File;
  kind: PromptAttachmentKind;
  previewUrl: string | null;
  /** Public path after upload to project public/ (images). */
  publicPath?: string | null;
};

export type MessageAttachment = {
  name: string;
  kind: PromptAttachmentKind | string;
  previewUrl?: string | null;
  publicPath?: string | null;
};

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function promptAttachmentKind(file: File): PromptAttachmentKind | null {
  const ext = extensionOf(file.name);
  const type = (file.type || "").toLowerCase();

  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
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

export function createPromptAttachment(file: File): PromptAttachment | null {
  const kind = promptAttachmentKind(file);
  if (!kind) return null;
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
  };
}

export function revokePromptAttachment(item: PromptAttachment) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
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

/** Best-effort PDF text extraction without a heavy PDF.js dependency. */
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

  const cleaned = parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

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

/** Markers used in the LLM payload — parsed back for chat display. */
export const ATTACH_IMAGE_RE =
  /\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe):\s*([^\|\]]+?)(?:\s*\|\s*public:([^\]]+))?\]/gi;
export const ATTACH_FILES_RE =
  /\[(?:Files|Fichiers):\s*([^\]]+)\]/gi;
export const ATTACH_DOC_RE =
  /###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte|PDF attached[^:]*):\s*([^\n]+)\n+/gi;
export const ATTACH_PUBLIC_HINT_RE =
  /—\s*saved in project as\s*`([^`]+)`/gi;

export function parseUserMessageContent(raw: string): {
  text: string;
  attachments: MessageAttachment[];
} {
  const attachments: MessageAttachment[] = [];
  let text = raw || "";

  for (const match of raw.matchAll(ATTACH_IMAGE_RE)) {
    const name = match[1].trim();
    const publicPath = (match[2] || "").trim() || null;
    if (name && !attachments.some((a) => a.name === name)) {
      attachments.push({ name, kind: "image", publicPath });
    } else if (name && publicPath) {
      const existing = attachments.find((a) => a.name === name);
      if (existing && !existing.publicPath) existing.publicPath = publicPath;
    }
  }
  // Legacy path hint after marker
  for (const match of raw.matchAll(
    /\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe):\s*([^\]]+)\]\s*(?:—\s*saved in project as\s*`([^`]+)`)?/gi,
  )) {
    const name = match[1].trim();
    const publicPath = (match[2] || "").trim() || null;
    if (!name) continue;
    const existing = attachments.find((a) => a.name === name);
    if (existing) {
      if (publicPath && !existing.publicPath) existing.publicPath = publicPath;
    } else {
      attachments.push({ name, kind: "image", publicPath });
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
    .replace(/This is a REFERENCE screenshot[\s\S]*?(?=\n\n|\Z)/gi, "")
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

  if (images.length) {
    chunks.push(
      `[${labels.importFiles}: ${images.map((a) => a.file.name).join(", ")}]`,
    );
    for (const img of images) {
      const pathPart = img.publicPath ? ` | public:${img.publicPath}` : "";
      chunks.push(
        `[${labels.imageAttached}: ${img.file.name}${pathPart}]\n` +
          "This is a REFERENCE screenshot/mockup for visual inspiration. " +
          "Match its layout, hierarchy and style in the app. " +
          "Do NOT call image generation / do NOT invent a new stock photo — implement UI in code.",
      );
    }
  }

  for (const doc of docs) {
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

export type ElementSelectionMarker = {
  tag: string;
  id?: string | null;
  className?: string | null;
  selector: string;
  text?: string;
};

/** Stable marker prepended to chat content so the agent targets a DOM element. */
export function formatElementSelectionMarker(
  sel: ElementSelectionMarker,
  label = "Sélection",
): string {
  const parts = [
    sel.tag || "element",
    sel.selector ? `selector:${sel.selector}` : "",
    sel.text ? `text:"${sel.text.replace(/"/g, "'").slice(0, 80)}"` : "",
  ].filter(Boolean);
  return `[${label}: ${parts.join(" | ")}]`;
}
