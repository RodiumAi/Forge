/**
 * Text elements <-> TipTap documents.
 *
 * The slide contract stores text as blocks (paragraphs, bullet and ordered
 * lists with a `level` per item) of inline runs (bold, italic, underline, an
 * https link, a theme color). TipTap edits the same thing as ProseMirror JSON.
 * The conversion is lossless both ways for what the contract can express;
 * anything else the editor could produce (a non https link, a nested list
 * deeper than level 4) is normalized into the contract.
 */

import type { TextElement } from "./model";

type Block = TextElement["content"][number];
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; link?: string; color?: string };
type Inline = { text?: string; runs?: Run[] };

export type PMMark = { type: string; attrs?: Record<string, unknown> };
export type PMNode = { type: string; text?: string; marks?: PMMark[]; attrs?: Record<string, unknown>; content?: PMNode[] };

export const MAX_LEVEL = 4;
const MAX_RUNS = 100;
const MAX_TEXT = 5000;
const COLOR_RE = /^(--[A-Za-z0-9-]{1,48}|#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8}))$/;

/** Contract color ("--accent", "#fff") to the CSS TipTap stores. */
export function colorToCss(color: string): string {
  return color.startsWith("--") ? `var(${color})` : color;
}

/** CSS color from TipTap back to a contract color, or undefined when not expressible. */
export function cssToColor(css: unknown): string | undefined {
  if (typeof css !== "string") return undefined;
  const value = css.trim();
  const v = /^var\((--[A-Za-z0-9-]{1,48})\)$/.exec(value);
  const color = v ? v[1] : value;
  return COLOR_RE.test(color) ? color : undefined;
}

export function safeLink(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  const value = href.trim();
  if (!value) return undefined;
  if (/^https:\/\//i.test(value)) return value.slice(0, 2000);
  if (/^http:\/\//i.test(value)) return `https://${value.slice(7)}`.slice(0, 2000);
  if (/^[a-z]+:/i.test(value)) return undefined;
  return `https://${value.replace(/^\/+/, "")}`.slice(0, 2000);
}

// ── contract to TipTap ──────────────────────────────────────────────────────

function runsOf(inline: Inline): Run[] {
  if (inline.runs && inline.runs.length) return inline.runs;
  return inline.text ? [{ text: inline.text }] : [];
}

function inlineNodes(inline: Inline): PMNode[] {
  const out: PMNode[] = [];
  for (const run of runsOf(inline)) {
    const marks: PMMark[] = [];
    if (run.bold) marks.push({ type: "bold" });
    if (run.italic) marks.push({ type: "italic" });
    if (run.underline) marks.push({ type: "underline" });
    if (run.link) marks.push({ type: "link", attrs: { href: run.link } });
    if (run.color) marks.push({ type: "textStyle", attrs: { color: colorToCss(run.color) } });
    const parts = run.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) out.push({ type: "hardBreak" });
      if (part) out.push(marks.length ? { type: "text", text: part, marks } : { type: "text", text: part });
    });
  }
  return out;
}

function paragraph(inline: Inline): PMNode {
  const content = inlineNodes(inline);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function listNode(block: Extract<Block, { items: unknown }>): PMNode {
  const type = block.type === "ordered-list" ? "orderedList" : "bulletList";
  const root: PMNode = { type, content: [] };
  // Stack of the last list item at each level, to nest deeper items under it.
  const stack: PMNode[] = [root];
  for (const item of block.items) {
    const level = Math.max(0, Math.min(MAX_LEVEL, item.level ?? 0));
    while (stack.length - 1 > level) stack.pop();
    while (stack.length - 1 < level) {
      const parent = stack[stack.length - 1];
      const lastItem = parent.content?.[parent.content.length - 1];
      if (!lastItem) break;
      const nested: PMNode = { type, content: [] };
      lastItem.content = [...(lastItem.content ?? []), nested];
      stack.push(nested);
    }
    const list = stack[stack.length - 1];
    list.content = [...(list.content ?? []), { type: "listItem", content: [paragraph(item)] }];
  }
  if (!root.content?.length) root.content = [{ type: "listItem", content: [{ type: "paragraph" }] }];
  return root;
}

export function textToDoc(content: TextElement["content"]): PMNode {
  const nodes = content.map((block) => (block.type === "paragraph" ? paragraph(block) : listNode(block)));
  return { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] };
}

// ── TipTap to contract ──────────────────────────────────────────────────────

function runFromText(node: PMNode): Run {
  const run: Run = { text: node.text ?? "" };
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") run.bold = true;
    else if (mark.type === "italic") run.italic = true;
    else if (mark.type === "underline") run.underline = true;
    else if (mark.type === "link") {
      const link = safeLink(mark.attrs?.href);
      if (link) run.link = link;
    } else if (mark.type === "textStyle") {
      const color = cssToColor(mark.attrs?.color);
      if (color) run.color = color;
    }
  }
  return run;
}

function sameMarks(a: Run, b: Run): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.link === b.link && a.color === b.color;
}

function plain(run: Run): boolean {
  return !run.bold && !run.italic && !run.underline && !run.link && !run.color;
}

/** Inline content of a paragraph node: plain `text`, or `runs` when any mark is used. */
export function inlineFromParagraph(node: PMNode | undefined): Inline {
  const runs: Run[] = [];
  for (const child of node?.content ?? []) {
    if (child.type === "hardBreak") {
      // A line break keeps the marks of the text before it so runs merge.
      const prev = runs[runs.length - 1];
      if (prev) prev.text += "\n";
      else runs.push({ text: "\n" });
      continue;
    }
    if (child.type !== "text") continue;
    const run = runFromText(child);
    const prev = runs[runs.length - 1];
    if (prev && sameMarks(prev, run)) prev.text += run.text;
    else runs.push(run);
  }
  const cleaned = runs.map(stripUndefined).filter((r) => r.text.length > 0);
  if (cleaned.length === 0) return { text: "" };
  if (cleaned.every(plain)) return { text: cleaned.map((r) => r.text).join("").slice(0, MAX_TEXT) };
  return { runs: capRuns(cleaned) };
}

function capRuns(runs: Run[]): Run[] {
  const capped = runs.slice(0, MAX_RUNS).map((r) => ({ ...r, text: r.text.slice(0, MAX_TEXT) }));
  if (runs.length > MAX_RUNS) {
    const rest = runs.slice(MAX_RUNS - 1).map((r) => r.text).join("");
    capped[MAX_RUNS - 1] = { text: rest.slice(0, MAX_TEXT) };
  }
  return capped;
}

function stripUndefined(run: Run): Run {
  const out: Run = { text: run.text };
  if (run.bold) out.bold = true;
  if (run.italic) out.italic = true;
  if (run.underline) out.underline = true;
  if (run.link) out.link = run.link;
  if (run.color) out.color = run.color;
  return out;
}

function listItems(list: PMNode, level: number, out: (Inline & { level?: number })[]) {
  for (const item of list.content ?? []) {
    if (item.type !== "listItem") continue;
    let wrote = false;
    for (const child of item.content ?? []) {
      if (child.type === "paragraph") {
        const inline = inlineFromParagraph(child);
        out.push(level > 0 ? { ...inline, level: Math.min(level, MAX_LEVEL) } : inline);
        wrote = true;
      } else if (child.type === "bulletList" || child.type === "orderedList") {
        if (!wrote) {
          out.push(level > 0 ? { text: "", level: Math.min(level, MAX_LEVEL) } : { text: "" });
          wrote = true;
        }
        listItems(child, level + 1, out);
      }
    }
  }
}

export function docToText(doc: PMNode): TextElement["content"] {
  const blocks: TextElement["content"] = [];
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph") blocks.push({ type: "paragraph", ...inlineFromParagraph(node) });
    else if (node.type === "bulletList" || node.type === "orderedList") {
      const items: (Inline & { level?: number })[] = [];
      listItems(node, 0, items);
      blocks.push({ type: node.type === "orderedList" ? "ordered-list" : "bullet-list", items: items.slice(0, 50) });
    }
  }
  return blocks.slice(0, 50);
}

/** Plain text of a text element (search, labels, AI context). */
export function plainText(content: TextElement["content"]): string {
  const inline = (i: Inline) => (i.runs ? i.runs.map((r) => r.text).join("") : (i.text ?? ""));
  return content.map((b) => (b.type === "paragraph" ? inline(b) : b.items.map(inline).join("\n"))).join("\n");
}
