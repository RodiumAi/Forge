/**
 * Files imported into the deck assistant: pictures (uploaded into the
 * project), PDF and PowerPoint files (read in the browser, their text sent
 * with the message). Nothing here needs a library: a .pptx is a zip read with
 * the native DecompressionStream, and the PDF text goes through
 * `extractPdfText` once its compressed content streams are inflated.
 */

import { extractPdfText } from "@/lib/prompt-attachments";

/** Largest file the assistant accepts, any type. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** Characters of document text sent with one message (all documents together). */
export const DOC_TEXT_BUDGET = 40_000;
/** Server limit on a chat message (`ChatSendBody.content`). */
export const MESSAGE_LIMIT = 50_000;
/** Room kept for the user text, the markers and the image line. */
const MESSAGE_MARGIN = 1_500;

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const IMAGE_ACCEPT = "image/*";
export const DOCUMENT_ACCEPT = `.pdf,application/pdf,.pptx,${PPTX_MIME}`;
export const IMPORT_ACCEPT = `${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`;

export type DocKind = "pdf" | "pptx";
export type ImportKind = "image" | DocKind;

export function importKind(file: Pick<File, "name" | "type">): ImportKind | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === PPTX_MIME || name.endsWith(".pptx")) return "pptx";
  return null;
}

export class ImportError extends Error {
  constructor(readonly code: "empty" | "unreadable") {
    super(code);
  }
}

export type ExtractedDocument = { text: string; truncated: boolean; slides?: number };

export async function extractDocument(file: File, kind: DocKind): Promise<ExtractedDocument> {
  const text = kind === "pdf" ? await readPdf(file) : await readPptx(file);
  return clip(text, DOC_TEXT_BUDGET, kind === "pptx" ? countSlides(text) : undefined);
}

function clip(text: string, max: number, slides?: number): ExtractedDocument {
  const clean = text.trim();
  if (!clean) throw new ImportError("empty");
  const out: ExtractedDocument = clean.length > max ? { text: clean.slice(0, max), truncated: true } : { text: clean, truncated: false };
  if (slides !== undefined) out.slides = slides;
  return out;
}

function countSlides(text: string): number {
  return (text.match(/^--- Slide \d+ ---$/gm) ?? []).length;
}

/**
 * Fits the documents of one message in what is left of the message limit
 * once the user text is counted. Each document keeps a share proportional to
 * its length; a cut one is flagged `truncated`.
 */
export function fitDocuments<T extends { text: string; truncated: boolean }>(docs: T[], textLength: number): T[] {
  const budget = Math.max(0, Math.min(DOC_TEXT_BUDGET, MESSAGE_LIMIT - MESSAGE_MARGIN - textLength - docs.length * 200));
  const total = docs.reduce((sum, doc) => sum + doc.text.length, 0);
  if (total <= budget) return docs;
  return docs.map((doc) => {
    const share = Math.floor((budget * doc.text.length) / total);
    return share >= doc.text.length ? doc : { ...doc, text: doc.text.slice(0, share), truncated: true };
  });
}

// ── bytes and inflate ────────────────────────────────────────────────────

async function readBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Inflates `data`; a stream with junk after its end keeps what came out before the error. */
export async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw", limit = 40 * 1024 * 1024): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream(format) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } catch {
    // Truncated or padded stream: keep the output so far.
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk.subarray(0, Math.min(chunk.length, size - at)), at);
    at += chunk.length;
  }
  return out;
}

// ── PDF ──────────────────────────────────────────────────────────────────

const TEXT_OPERATOR = /\)\s*Tj|\]\s*TJ/;

/**
 * Most PDFs compress their page content (FlateDecode): the text operators
 * only show once those streams are inflated. The inflated streams are added
 * after the raw bytes and the whole goes through `extractPdfText`.
 */
async function readPdf(file: File): Promise<string> {
  const bytes = await readBytes(file);
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: BlobPart[] = [bytes as BlobPart];
  let budget = 30 * 1024 * 1024;
  const streamRe = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw)) && budget > 0) {
    if (match.index > 0 && /end$/.test(raw.slice(Math.max(0, match.index - 3), match.index))) continue;
    const dictStart = raw.lastIndexOf("obj", match.index);
    const dict = raw.slice(dictStart < 0 ? Math.max(0, match.index - 600) : dictStart, match.index);
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    streamRe.lastIndex = end;
    if (!/\/FlateDecode/.test(dict) || /\/Subtype\s*\/Image/.test(dict)) continue;
    const inflated = await inflate(bytes.subarray(start, end), "deflate", budget);
    budget -= inflated.length;
    if (inflated.length) parts.push("\n", inflated as BlobPart);
  }
  const expanded = new File(parts, file.name, { type: "application/pdf" });
  if (!TEXT_OPERATOR.test(new TextDecoder("latin1").decode(await readBytes(expanded)))) {
    throw new ImportError("empty");
  }
  const text = await extractPdfText(expanded);
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 3) throw new ImportError("empty");
  return text;
}

// ── PPTX ─────────────────────────────────────────────────────────────────

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

export function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ImportError("unreadable");
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const names = new TextDecoder("utf-8");
  const out = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new ImportError("unreadable");
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    out.set(name, { name, method, compressedSize, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

async function zipRead(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.offset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw new ImportError("unreadable");
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflate(data, "deflate-raw");
  throw new ImportError("unreadable");
}

async function zipText(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;
  return new TextDecoder("utf-8").decode(await zipRead(bytes, entry));
}

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

/** Elements named `local` under `root`, whatever their namespace prefix. */
function byName(root: Element | Document, local: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((el) => el.localName === local);
}

function child(el: Element, local: string): Element | undefined {
  return Array.from(el.children).find((c) => c.localName === local);
}

function relationships(xml: string | null): Map<string, { target: string; type: string }> {
  const out = new Map<string, { target: string; type: string }>();
  const doc = xml ? parseXml(xml) : null;
  if (!doc) return out;
  for (const rel of byName(doc, "Relationship")) {
    out.set(rel.getAttribute("Id") ?? "", { target: rel.getAttribute("Target") ?? "", type: rel.getAttribute("Type") ?? "" });
  }
  return out;
}

/** `../notesSlides/n1.xml` seen from `ppt/slides/` becomes `ppt/notesSlides/n1.xml`. */
function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece && piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

function paragraphs(el: Element): string[] {
  return byName(el, "p")
    .filter((p) => p.namespaceURI?.includes("drawingml") ?? true)
    .map((p) => byName(p, "t").map((t) => t.textContent ?? "").join("").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const SKIPPED_PLACEHOLDERS = new Set(["dt", "ftr", "sldNum", "hdr", "sldImg"]);

function placeholderType(shape: Element): string | null {
  const nv = child(shape, "nvSpPr");
  const nvPr = nv ? child(nv, "nvPr") : undefined;
  const ph = nvPr ? child(nvPr, "ph") : undefined;
  if (!ph) return null;
  return ph.getAttribute("type") ?? "body";
}

type SlideText = { title: string[]; subtitle: string[]; body: string[] };

function slideText(doc: Document): SlideText {
  const out: SlideText = { title: [], subtitle: [], body: [] };
  for (const shape of byName(doc, "sp")) {
    const type = placeholderType(shape);
    if (type && SKIPPED_PLACEHOLDERS.has(type)) continue;
    const body = child(shape, "txBody");
    if (!body) continue;
    const lines = paragraphs(body);
    if (type === "title" || type === "ctrTitle") out.title.push(...lines);
    else if (type === "subTitle") out.subtitle.push(...lines);
    else out.body.push(...lines);
  }
  for (const table of byName(doc, "tbl")) {
    for (const row of byName(table, "tr")) {
      const cells = byName(row, "tc").map((cell) => paragraphs(cell).join(" ")).filter(Boolean);
      if (cells.length) out.body.push(cells.join(" | "));
    }
  }
  return out;
}

function notesText(doc: Document): string {
  const lines: string[] = [];
  for (const shape of byName(doc, "sp")) {
    const type = placeholderType(shape);
    if (type !== "body") continue;
    const body = child(shape, "txBody");
    if (body) lines.push(...paragraphs(body));
  }
  return lines.join(" ");
}

/** Slide parts in presentation order (presentation.xml), else by number. */
async function slideOrder(bytes: Uint8Array, entries: Map<string, ZipEntry>): Promise<string[]> {
  const rels = relationships(await zipText(bytes, entries, "ppt/_rels/presentation.xml.rels"));
  const pres = await zipText(bytes, entries, "ppt/presentation.xml");
  const doc = pres ? parseXml(pres) : null;
  const ordered: string[] = [];
  if (doc) {
    for (const id of byName(doc, "sldId")) {
      const rid = Array.from(id.attributes).find((a) => a.localName === "id" && a.name !== "id")?.value;
      const rel = rid ? rels.get(rid) : undefined;
      if (rel) {
        const path = resolvePath("ppt", rel.target);
        if (entries.has(path) && !ordered.includes(path)) ordered.push(path);
      }
    }
  }
  if (ordered.length) return ordered;
  return Array.from(entries.keys())
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]));
}

/**
 * The text of a PowerPoint, one section per slide in order:
 *
 *     --- Slide 1 ---
 *     Title: ...
 *     Subtitle: ...
 *     - body line
 *     Notes: ...
 */
export async function pptxText(bytes: Uint8Array): Promise<string> {
  const entries = zipEntries(bytes);
  const order = await slideOrder(bytes, entries);
  if (!order.length) throw new ImportError("unreadable");
  const sections: string[] = [];
  for (const [index, path] of order.entries()) {
    const xml = await zipText(bytes, entries, path);
    const doc = xml ? parseXml(xml) : null;
    const lines = [`--- Slide ${index + 1} ---`];
    if (doc) {
      const text = slideText(doc);
      if (text.title.length) lines.push(`Title: ${text.title.join(" ")}`);
      if (text.subtitle.length) lines.push(`Subtitle: ${text.subtitle.join(" ")}`);
      for (const line of text.body) lines.push(`- ${line}`);
      const slideRels = relationships(await zipText(bytes, entries, path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels")));
      const notesRel = Array.from(slideRels.values()).find((rel) => rel.type.endsWith("/notesSlide"));
      if (notesRel) {
        const notesXml = await zipText(bytes, entries, resolvePath("ppt/slides", notesRel.target));
        const notesDoc = notesXml ? parseXml(notesXml) : null;
        const notes = notesDoc ? notesText(notesDoc) : "";
        if (notes) lines.push(`Notes: ${notes}`);
      }
    }
    if (lines.length === 1) lines.push("(no text)");
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n");
}

async function readPptx(file: File): Promise<string> {
  return pptxText(await readBytes(file));
}
