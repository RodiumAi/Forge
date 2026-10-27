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

// ── cover, presenter and setup pages ───────────────────────────────────────

export type CodelabCover = NonNullable<Codelab["cover"]>;
export type CodelabPresenter = NonNullable<Codelab["presenter"]>;
export type CodelabSetup = NonNullable<Codelab["setup"]>;

const LANGUAGE_RE = /^[a-z0-9+#-]{1,32}$/;

function text(value: string | undefined, max: number): string | undefined {
  return value && value.trim() ? value.slice(0, max) : undefined;
}

export function httpsUrl(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  return /^https:\/\/\S+$/i.test(v) ? v.slice(0, 2000) : undefined;
}

/** Drops undefined keys; undefined when nothing is left. */
function compact<T extends object>(value: T): T | undefined {
  const out = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length ? out : undefined;
}

/**
 * The editor keeps a draft of each section (half-typed URLs, empty rows);
 * codelab.json only ever gets what the schema accepts.
 */
export function cleanCover(draft: CodelabCover | undefined): CodelabCover | undefined {
  if (!draft) return undefined;
  const highlights = (draft.highlights ?? []).map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 8);
  return compact({
    eyebrow: text(draft.eyebrow, 160),
    highlights: highlights.length ? highlights : undefined,
    showQr: draft.showQr === false ? false : undefined,
  });
}

export function cleanPresenter(draft: CodelabPresenter | undefined): CodelabPresenter | undefined {
  if (!draft) return undefined;
  const links = (draft.links ?? [])
    .map((link) => ({ label: link.label.trim().slice(0, 60), url: httpsUrl(link.url) }))
    .filter((link): link is { label: string; url: string } => !!link.label && !!link.url)
    .slice(0, 6);
  return compact({
    name: text(draft.name, 120),
    role: text(draft.role, 120),
    company: text(draft.company, 120),
    photo: draft.photo && /^(?!.*\.\.)(?!\/)[A-Za-z0-9_./-]+$/.test(draft.photo) ? draft.photo : undefined,
    bio: text(draft.bio, 1500),
    links: links.length ? links : undefined,
  });
}

export function cleanSetup(draft: CodelabSetup | undefined): CodelabSetup | undefined {
  if (!draft) return undefined;
  const tools = (draft.tools ?? [])
    .filter((tool) => tool.name.trim())
    .map((tool) => compact({ name: tool.name.slice(0, 80), version: text(tool.version, 40), url: httpsUrl(tool.url) })!)
    .slice(0, 20);
  const groups = (draft.groups ?? [])
    .filter((group) => group.title.trim())
    .map((group) => ({
      title: group.title.slice(0, 120),
      items: group.items
        .filter((item) => item.text.trim())
        .map((item) => compact({ text: item.text.slice(0, 300), url: httpsUrl(item.url), code: text(item.code, 200) })!)
        .slice(0, 12),
    }))
    .slice(0, 6);
  const promo = draft.promo?.code?.trim()
    ? compact({ code: draft.promo.code.trim().slice(0, 64), label: text(draft.promo.label, 200), url: httpsUrl(draft.promo.url) })
    : undefined;
  const commands = (draft.commands ?? [])
    .filter((command) => command.code.trim())
    .map((command) => {
      const language = (command.language ?? "").trim().toLowerCase();
      return compact({
        label: text(command.label, 120),
        language: LANGUAGE_RE.test(language) ? language : undefined,
        code: command.code.slice(0, 4000),
      })!;
    })
    .slice(0, 12);
  return compact({
    intro: text(draft.intro, 1000),
    tools: tools.length ? tools : undefined,
    groups: groups.length ? groups : undefined,
    promo,
    commands: commands.length ? commands : undefined,
  });
}

/** codelab.json with one page flag set; `pages` disappears when both are unset. */
export function withPageFlag(codelab: Codelab, page: "presenter" | "setup", shown: boolean | undefined): Codelab {
  const pages = compact({ ...(codelab.pages ?? {}), [page]: shown });
  const next = { ...codelab, pages };
  if (!pages) delete next.pages;
  return next;
}

/** codelab.json with a section replaced; absent when empty. */
export function withSection<K extends "cover" | "presenter" | "setup">(
  codelab: Codelab,
  key: K,
  value: Codelab[K] | undefined,
): Codelab {
  const next = { ...codelab, [key]: value };
  if (value === undefined) delete next[key];
  return next;
}
