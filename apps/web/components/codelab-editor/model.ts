/**
 * Pure edits of codelab.json made by the editor (steps list, durations) and
 * the snippets the toolbar inserts into a step. No React, easy to test.
 */

import type { Codelab } from "@/lib/contracts/forge-design";

export type CodelabStep = Codelab["steps"][number];

const MAX_STEPS = 200;

export function slugify(text: string, fallback = "etape", max = 40): string {
  const slug = (text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function totalMinutes(codelab: Codelab): number {
  return Math.min(
    6000,
    codelab.steps.reduce((sum, step) => sum + (step.minutes || 0), 0),
  );
}

/** codelab.json with its total duration recomputed from the steps. */
export function withDuration(codelab: Codelab): Codelab {
  return { ...codelab, durationMinutes: totalMinutes(codelab) };
}

function nextNumber(codelab: Codelab): number {
  let highest = 0;
  for (const step of codelab.steps) {
    const match = /^steps\/(\d{2,3})-/.exec(step.file);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

export function stepFile(number: number, slug: string): string {
  return `steps/${String(number).padStart(number < 100 ? 2 : 3, "0")}-${slugify(slug)}.md`;
}

/** A new step after `afterIndex` (or at the end); its file number is never reused. */
export function addStep(codelab: Codelab, title: string, afterIndex?: number): { codelab: Codelab; step: CodelabStep } {
  if (codelab.steps.length >= MAX_STEPS) throw new Error("too many steps");
  const taken = new Set(codelab.steps.map((s) => s.id));
  const base = slugify(title || "etape", "etape", 50);
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base.slice(0, 58)}-${n}`;
  const step: CodelabStep = { id, title: title || undefined, file: stepFile(nextNumber(codelab), id), minutes: 5 };
  const at = afterIndex === undefined ? codelab.steps.length : Math.min(afterIndex + 1, codelab.steps.length);
  const steps = [...codelab.steps.slice(0, at), step, ...codelab.steps.slice(at)];
  return { codelab: withDuration({ ...codelab, steps }), step };
}

export function removeStep(codelab: Codelab, id: string): Codelab {
  return withDuration({ ...codelab, steps: codelab.steps.filter((s) => s.id !== id) });
}

export function moveStep(codelab: Codelab, from: number, to: number): Codelab {
  if (from === to || from < 0 || to < 0 || from >= codelab.steps.length || to >= codelab.steps.length) return codelab;
  const steps = [...codelab.steps];
  const [moved] = steps.splice(from, 1);
  steps.splice(to, 0, moved);
  return { ...codelab, steps };
}

export function updateStep(codelab: Codelab, id: string, patch: Partial<Pick<CodelabStep, "title" | "minutes">>): Codelab {
  const steps = codelab.steps.map((s) => {
    if (s.id !== id) return s;
    const next = { ...s, ...patch };
    if (patch.minutes !== undefined) next.minutes = Math.max(0, Math.min(600, Math.round(patch.minutes || 0)));
    if (patch.title !== undefined && !patch.title.trim()) delete next.title;
    return next;
  });
  return withDuration({ ...codelab, steps });
}

export type SnippetKind = "code" | "terminal" | "tabs" | "callout" | "image" | "download" | "tree" | "diff";

const FENCE = "```";

/** Markdown inserted by the toolbar; `selection` becomes the block's content when it fits. */
export function snippet(kind: SnippetKind, selection = ""): string {
  const body = selection.trim();
  switch (kind) {
    case "code":
      return `${FENCE}py title="main.py"\n${body || 'print("Bonjour")'}\n${FENCE}\n`;
    case "diff":
      return `${FENCE}py diff title="main.py"\n${body || "-ancien = 1\n+nouveau = 2"}\n${FENCE}\n`;
    case "terminal":
      return `${FENCE}terminal\n${body ? body.split("\n").map((l) => (l.startsWith("$ ") ? l : `$ ${l}`)).join("\n") : "$ npm install\nadded 12 packages"}\n${FENCE}\n`;
    case "tabs":
      return `:::tabs group="lang"\n${FENCE}py title="main.py"\n${body || 'print("Bonjour")'}\n${FENCE}\n${FENCE}js title="main.js"\nconsole.log("Bonjour");\n${FENCE}\n:::\n`;
    case "callout":
      return `:::tip\n${body || "Votre astuce ici."}\n:::\n`;
    case "image":
      return `![${body || "Description de l'image"}](public/images/image.webp)\n`;
    case "download":
      return `${FENCE}download\n${body || "starter"}\n${FENCE}\n`;
    case "tree":
      return `${FENCE}tree\n${body || "projet/\n  src/\n    main.py\n  README.md"}\n${FENCE}\n`;
    default:
      return "";
  }
}

/** Insert `text` in `value` at a selection, on its own lines. Returns the new value and caret. */
export function insertBlock(value: string, start: number, end: number, text: string): { value: string; caret: number } {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  const tail = after && !after.startsWith("\n") ? "\n" : "";
  const next = `${before}${lead}${text}${tail}${after}`;
  return { value: next, caret: before.length + lead.length + text.length };
}

export type CodelabDownload = NonNullable<Codelab["downloads"]>[number];

/** Declare `files/...` (a file, or a folder as a ZIP) as a download; reuses an entry with the same path. */
export function addDownload(codelab: Codelab, path: string, zip: boolean): { codelab: Codelab; id: string } {
  const clean = path.replace(/\/+$/, "");
  const existing = (codelab.downloads ?? []).find((d) => d.path === clean && Boolean(d.zip) === zip);
  if (existing) return { codelab, id: existing.id };
  if ((codelab.downloads ?? []).length >= 50) throw new Error("too many downloads");
  const name = clean.split("/").pop() || "fichier";
  const taken = new Set((codelab.downloads ?? []).map((d) => d.id));
  const base = slugify(name.replace(/\.[^.]+$/, ""), "fichier", 50);
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  const entry: CodelabDownload = { id, label: zip ? `${name}.zip` : name, path: clean, ...(zip ? { zip: true } : {}) };
  return { codelab: { ...codelab, downloads: [...(codelab.downloads ?? []), entry] }, id };
}

export function removeDownload(codelab: Codelab, id: string): Codelab {
  const downloads = (codelab.downloads ?? []).filter((d) => d.id !== id);
  const { downloads: _previous, ...rest } = codelab;
  void _previous;
  return downloads.length ? { ...rest, downloads } : rest;
}

/** Text field with one entry per line, for prerequisites and objectives. */
export function linesOf(text: string, max = 30): string[] | undefined {
  const items = text
    .split("\n")
    .map((l) => l.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, max);
  return items.length ? items : undefined;
}
