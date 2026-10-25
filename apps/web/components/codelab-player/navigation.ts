/**
 * Pure navigation logic of the codelab player: which view the URL hash
 * points at, progress kept in the browser, and the in-codelab search.
 */

import type { Codelab } from "@/lib/contracts/forge-design";

import { parseBlocks, walkBlocks } from "./markdown/blocks";

/**
 * Home page (no hash), the optional presenter (`#_presenter`) and setup
 * (`#_setup`) pages, a step (`#<stepId>`), or the end page (`#_end`).
 * Reserved hashes start with "_", which a step id never does.
 */
export type View =
  | { kind: "home" }
  | { kind: "presenter" }
  | { kind: "setup" }
  | { kind: "step"; index: number }
  | { kind: "end" };

export type IntroPage = "presenter" | "setup";

export const END_HASH = "_end";
export const PRESENTER_HASH = "_presenter";
export const SETUP_HASH = "_setup";

const filled = (value: string | undefined | null) => !!value && !!value.trim();

/** The presenter, falling back to the author for the name (old codelabs only have `author`). */
export function presenterOf(codelab: Codelab): {
  name: string;
  url?: string;
  role?: string;
  company?: string;
  photo?: string;
  bio?: string;
  links: { label: string; url: string }[];
} | null {
  const p = codelab.presenter;
  const name = (p?.name?.trim() || codelab.author?.name?.trim() || "").trim();
  const links = (p?.links ?? []).filter((link) => filled(link.label) && filled(link.url));
  if (!name && !filled(p?.role) && !filled(p?.company) && !p?.photo && !filled(p?.bio) && !links.length) return null;
  return {
    name,
    url: codelab.author?.url,
    role: p?.role?.trim() || undefined,
    company: p?.company?.trim() || undefined,
    photo: p?.photo || undefined,
    bio: p?.bio?.trim() || undefined,
    links,
  };
}

/** True when the setup page has something of its own to show. */
export function setupFilled(codelab: Codelab): boolean {
  const s = codelab.setup;
  if (!s) return false;
  return (
    filled(s.intro) ||
    !!s.tools?.length ||
    !!s.groups?.some((group) => group.items.length || filled(group.title)) ||
    !!s.promo?.code ||
    !!s.commands?.length
  );
}

/**
 * Pages shown between the cover and step 1. `pages.x === false` hides one;
 * otherwise it shows when filled (the setup page also when forced on and
 * there are prerequisites to list).
 */
export function introPages(codelab: Codelab): IntroPage[] {
  const pages: IntroPage[] = [];
  const flags = codelab.pages ?? {};
  const presenter = presenterOf(codelab);
  const presenterOwn = !!codelab.presenter && !!presenter;
  if (flags.presenter !== false && (presenterOwn || (flags.presenter === true && presenter))) pages.push("presenter");
  if (flags.setup !== false && (setupFilled(codelab) || (flags.setup === true && !!codelab.prerequisites?.length))) {
    pages.push("setup");
  }
  return pages;
}

export function viewFromHash(hash: string, codelab: Codelab): View {
  const raw = decodeURIComponent((hash || "").replace(/^#/, "")).trim();
  if (!raw) return { kind: "home" };
  if (raw === END_HASH) return { kind: "end" };
  if (raw === PRESENTER_HASH || raw === SETUP_HASH) {
    const kind = raw === PRESENTER_HASH ? "presenter" : "setup";
    return introPages(codelab).includes(kind) ? { kind } : { kind: "home" };
  }
  const index = codelab.steps.findIndex((step) => step.id === raw);
  return index >= 0 ? { kind: "step", index } : { kind: "home" };
}

export function hashOfView(view: View, codelab: Codelab): string {
  if (view.kind === "home") return "";
  if (view.kind === "end") return `#${END_HASH}`;
  if (view.kind === "presenter") return `#${PRESENTER_HASH}`;
  if (view.kind === "setup") return `#${SETUP_HASH}`;
  const step = codelab.steps[view.index];
  return step ? `#${encodeURIComponent(step.id)}` : "";
}

/** Every view in reading order: cover, intro pages, steps, end. */
export function viewSequence(codelab: Codelab): View[] {
  return [
    { kind: "home" },
    ...introPages(codelab).map((kind) => ({ kind }) as View),
    ...codelab.steps.map((_, index) => ({ kind: "step", index }) as View),
    { kind: "end" },
  ];
}

export function sameView(a: View, b: View): boolean {
  return a.kind === b.kind && (a.kind !== "step" || (b.kind === "step" && a.index === b.index));
}

export function nextView(view: View, codelab: Codelab): View {
  const sequence = viewSequence(codelab);
  const at = sequence.findIndex((item) => sameView(item, view));
  if (at < 0 || view.kind === "end") return view;
  return sequence[at + 1] ?? view;
}

export function previousView(view: View, codelab: Codelab): View {
  if (view.kind === "home") return view;
  const sequence = viewSequence(codelab);
  const at = sequence.findIndex((item) => sameView(item, view));
  return at > 0 ? sequence[at - 1] : { kind: "home" };
}

/** Share of the codelab's minutes covered by visited steps (0 to 100). */
export function progressPercent(codelab: Codelab, visited: ReadonlySet<string>): number {
  const steps = codelab.steps;
  if (!steps.length) return 0;
  const total = steps.reduce((sum, step) => sum + Math.max(step.minutes, 1), 0);
  const done = steps.reduce((sum, step) => sum + (visited.has(step.id) ? Math.max(step.minutes, 1) : 0), 0);
  return Math.round((done / total) * 100);
}

export type Progress = { visited: string[]; last?: string };

export function progressKey(storageKey: string): string {
  return `${storageKey}:progress`;
}

export function loadProgress(storageKey: string): Progress {
  try {
    const raw = window.localStorage.getItem(progressKey(storageKey));
    if (!raw) return { visited: [] };
    const data = JSON.parse(raw) as Partial<Progress>;
    const visited = Array.isArray(data.visited) ? data.visited.filter((v): v is string => typeof v === "string") : [];
    return { visited: visited.slice(0, 500), last: typeof data.last === "string" ? data.last : undefined };
  } catch {
    return { visited: [] };
  }
}

export function saveProgress(storageKey: string, progress: Progress): void {
  try {
    window.localStorage.setItem(progressKey(storageKey), JSON.stringify(progress));
  } catch {
    // progress then lives for this page only
  }
}

export function clearProgress(storageKey: string): void {
  try {
    window.localStorage.removeItem(progressKey(storageKey));
  } catch {
    // nothing stored
  }
}

/** Plain text of a step: prose without Markdown marks, code as written. */
export function stepText(markdown: string): string {
  const parts: string[] = [];
  walkBlocks(parseBlocks(markdown), (block) => {
    if (block.type === "markdown") {
      parts.push(
        block.text
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/[`*_>#|~]/g, " "),
      );
    } else if (block.type === "code" || block.type === "terminal" || block.type === "tree") {
      parts.push(block.code);
    } else if (block.type === "callout" && block.title) {
      parts.push(block.title);
    }
  });
  return parts.join("\n").replace(/[ \t]+/g, " ");
}

export type SearchHit = { index: number; title: string; before: string; match: string; after: string; count: number };

/** Lower case without accents, one output unit per input unit (offsets stay valid). */
export function fold(text: string): string {
  return text.replace(/[\s\S]/g, (ch) => (ch.normalize("NFD")[0] ?? ch).toLowerCase()[0] ?? ch);
}

/**
 * Steps containing `query` (case and accent insensitive), with a snippet
 * around the first match. Titles count as content.
 */
export function searchCodelab(
  query: string,
  codelab: Codelab,
  steps: Record<string, string>,
  titleOf: (index: number) => string,
  limit = 30,
): SearchHit[] {
  const needle = fold(query.trim());
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  codelab.steps.forEach((step, index) => {
    const title = titleOf(index);
    const text = `${title}\n${stepText(steps[step.id] ?? "")}`;
    const folded = fold(text);
    const at = folded.indexOf(needle);
    if (at < 0) return;
    let count = 0;
    for (let i = at; i >= 0; i = folded.indexOf(needle, i + needle.length)) count += 1;
    const start = Math.max(0, at - 40);
    const end = Math.min(text.length, at + needle.length + 60);
    hits.push({
      index,
      title,
      before: (start > 0 ? "…" : "") + text.slice(start, at).replace(/\s+/g, " "),
      match: text.slice(at, at + needle.length),
      after: text.slice(at + needle.length, end).replace(/\s+/g, " ") + (end < text.length ? "…" : ""),
      count,
    });
  });
  return hits.slice(0, limit);
}
