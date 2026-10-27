/**
 * The deck editor side of the slides AI contract (docs/contracts/deck-ai-events.md):
 * request bodies with a target and quick actions, and the `deck.*` events
 * applied to the local document.
 */

import { deckSchema, slideSchema, type Deck, type Slide } from "@/lib/contracts/forge-design";
import { findElement, removeSlide, type Doc } from "./model";

export const QUICK_ACTIONS = ["shorten", "punchier", "change_layout", "add_visual", "translate"] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

export type AiTarget = { slideId: string; elementId?: string };

export type MessageBody = {
  content: string;
  mode: "agent";
  model?: string;
  target?: AiTarget;
  action?: QuickAction;
  action_input?: string | null;
};

/**
 * Target sent with a message: the selected element when exactly one is
 * selected, the slide when the slide (or several of its elements) is
 * selected, nothing (whole deck) otherwise.
 */
export function targetFor(opts: { slideId: string | null; slideSelected: boolean; selection: string[]; deckWide?: boolean }): AiTarget | undefined {
  if (opts.deckWide || !opts.slideId) return undefined;
  if (opts.selection.length === 1) return { slideId: opts.slideId, elementId: opts.selection[0] };
  if (opts.selection.length > 1 || opts.slideSelected) return { slideId: opts.slideId };
  return undefined;
}

export function messageBody(content: string, opts: { target?: AiTarget; model?: string | null } = {}): MessageBody {
  const body: MessageBody = { content, mode: "agent" };
  if (opts.model) body.model = opts.model;
  if (opts.target) body.target = opts.target;
  return body;
}

/**
 * A quick action. `content` is the visible label (the API requires a
 * non-empty message); `action_input` carries the layout or the language.
 * Quick actions always target at least the current slide.
 */
export function quickActionBody(
  action: QuickAction,
  label: string,
  target: AiTarget,
  input?: string | null,
  model?: string | null,
): MessageBody {
  const body: MessageBody = { content: label, mode: "agent", target, action };
  if (action === "change_layout" || action === "translate") body.action_input = input?.trim() || null;
  if (model) body.model = model;
  return body;
}

// ── events ──────────────────────────────────────────────────────────────────

export type DeckEvent =
  | { type: "deck.deck"; deck: Deck }
  | { type: "deck.slide"; slideId: string; slide: Slide; notes?: string; fallback: boolean; target?: AiTarget }
  | { type: "deck.slide_removed"; slideId: string };

/** Parse a stream payload into a deck event; invalid documents are ignored. */
export function parseDeckEvent(payload: Record<string, unknown>): DeckEvent | null {
  const type = payload.type;
  if (type === "deck.deck") {
    const deck = deckSchema.safeParse(payload.deck);
    return deck.success ? { type, deck: deck.data } : null;
  }
  if (type === "deck.slide") {
    const slide = slideSchema.safeParse(payload.slide);
    if (!slide.success) return null;
    const slideId = typeof payload.slide_id === "string" ? payload.slide_id : slide.data.id;
    const target = payload.target as AiTarget | undefined;
    return {
      type,
      slideId,
      slide: slide.data,
      notes: typeof payload.notes === "string" ? payload.notes : undefined,
      fallback: payload.fallback === true,
      target: target && typeof target.slideId === "string" ? target : undefined,
    };
  }
  if (type === "deck.slide_removed" && typeof payload.slide_id === "string") {
    return { type, slideId: payload.slide_id };
  }
  return null;
}

/**
 * Apply one event to the document. Only the slide (or deck) named by the
 * event changes: other slides keep their local, possibly unsaved, edits.
 */
export function applyDeckEvent(doc: Doc, event: DeckEvent): Doc {
  if (event.type === "deck.deck") {
    const slides: Record<string, Slide> = {};
    for (const ref of event.deck.slides) slides[ref.id] = doc.slides[ref.id] ?? { id: ref.id, elements: [] };
    return { deck: event.deck, slides };
  }
  if (event.type === "deck.slide") {
    const slide = { ...event.slide, id: event.slideId };
    const listed = doc.deck.slides.some((ref) => ref.id === event.slideId);
    const deck = listed ? doc.deck : { ...doc.deck, slides: [...doc.deck.slides, { id: event.slideId, layout: "text" }] };
    return { deck, slides: { ...doc.slides, [event.slideId]: slide } };
  }
  return removeSlide(doc, event.slideId);
}

// ── warnings shown on slides ────────────────────────────────────────────────

export type SlideNotice = { slideId: string; code: "SLIDE_FALLBACK" | "TARGET_SCOPE"; detail?: string };

/** `SLIDE_FALLBACK` and `TARGET_SCOPE` warnings as notices for the slide they concern. */
export function noticeFromWarning(payload: Record<string, unknown>): SlideNotice | null {
  if (payload.type !== "warning") return null;
  const violation = payload.violation as { code?: unknown; path?: unknown } | undefined;
  const message = typeof payload.message === "string" ? payload.message : "";
  const code = typeof violation?.code === "string" ? violation.code : message.split(":")[0];
  if (code !== "SLIDE_FALLBACK" && code !== "TARGET_SCOPE") return null;
  const path = typeof violation?.path === "string" ? violation.path : "";
  const fromPath = /slides\/([A-Za-z0-9_-]+)\.json$/.exec(path)?.[1];
  const detail = message.includes(":") ? message.slice(message.indexOf(":") + 1).trim() : undefined;
  const slideId = fromPath ?? (code === "SLIDE_FALLBACK" ? detail : undefined);
  if (!slideId) return null;
  return { slideId, code, detail: code === "TARGET_SCOPE" ? detail : undefined };
}

/** Name of the target for the chat chip. */
export function describeTarget(doc: Doc | null, target: AiTarget | undefined): { slideIndex: number; element?: string } | null {
  if (!doc || !target) return null;
  const slideIndex = doc.deck.slides.findIndex((ref) => ref.id === target.slideId);
  if (slideIndex < 0) return null;
  if (!target.elementId) return { slideIndex };
  const element = findElement(doc.slides[target.slideId], target.elementId);
  return { slideIndex, element: element ? (element.name ?? element.id) : target.elementId };
}

// ── outline (first message on a blank deck) ─────────────────────────────────

export type OutlineTask = { id: string; title: string; detail: string; layout: string; visual: boolean; status?: string };

export function tasksFromPlan(payload: Record<string, unknown>): OutlineTask[] {
  const raw = Array.isArray(payload.tasks) ? payload.tasks : [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      id: String(t.id ?? ""),
      title: String(t.title ?? ""),
      detail: String(t.detail ?? ""),
      layout: String(t.layout ?? "text"),
      visual: t.visual === true,
      status: typeof t.status === "string" ? t.status : "pending",
    }))
    .filter((t) => t.id);
}

/** The edited outline as sent to `confirm-plan`. */
export function confirmPlanBody(tasks: OutlineTask[]): { plan: OutlineTask[] } {
  return {
    plan: tasks
      .filter((t) => t.title.trim())
      .map((t) => ({ id: t.id, title: t.title.trim(), detail: t.detail, layout: t.layout, visual: t.visual, status: "pending" })),
  };
}

// ── attached images ─────────────────────────────────────────────────────────

const IMAGES_MARKER = /\n*\[(?:Images|Images jointes)\s*:\s*([^\]\n]+)\]/gi;

/** Adds the attached project images to a message as one `[Images: ...]` line. */
export function withImages(content: string, paths: string[]): string {
  if (!paths.length) return content;
  const marker = `[Images: ${paths.join(", ")}]`;
  return content ? `${content}\n\n${marker}` : marker;
}

/** Splits a stored user message into its text and its attached image paths. */
export function splitImages(content: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = content.replace(IMAGES_MARKER, (_m, list: string) => {
    for (const raw of list.split(",")) {
      const path = raw.trim();
      if (path.startsWith("public/") && !images.includes(path)) images.push(path);
    }
    return "";
  });
  return { text: text.trim(), images };
}

// ── attached documents (PDF, PowerPoint) ────────────────────────────────────

export type DocumentPart = { name: string; kind: "pdf" | "pptx"; text: string; truncated: boolean };

const DOCUMENT_BLOCK = /\n*\[Document:\s*([^\]|\n]{1,200}?)\s*\|\s*(pdf|pptx)\s*(\|\s*truncated\s*)?\]\n([\s\S]*?)\n\[\/Document\]/gi;

/** A file name safe inside the marker: no brackets, bars or line breaks. */
function markerName(name: string): string {
  return name.replace(/[[\]|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "document";
}

/**
 * Appends the text of each imported document as one block:
 * `[Document: brief.pdf | pdf]` ... `[/Document]` (`| truncated` when cut).
 * The API reads these blocks into the deck prompts (deck_ai/attachments.py).
 */
export function withDocuments(content: string, docs: DocumentPart[]): string {
  if (!docs.length) return content;
  const blocks = docs.map((doc) => {
    const text = doc.text.replace(/\[\/Document\]/gi, "[/ Document]").trim();
    return `[Document: ${markerName(doc.name)} | ${doc.kind}${doc.truncated ? " | truncated" : ""}]\n${text}\n[/Document]`;
  });
  return [content, ...blocks].filter(Boolean).join("\n\n");
}

/** Splits a stored user message into its text and its documents (names only). */
export function splitDocuments(content: string): { text: string; documents: Array<Omit<DocumentPart, "text">> } {
  const documents: Array<Omit<DocumentPart, "text">> = [];
  const text = content.replace(DOCUMENT_BLOCK, (_m, name: string, kind: string, cut: string | undefined) => {
    documents.push({ name: name.trim(), kind: kind.toLowerCase() === "pptx" ? "pptx" : "pdf", truncated: !!cut });
    return "";
  });
  return { text: text.trim(), documents };
}
