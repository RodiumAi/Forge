/**
 * Pure navigation logic of the codelab player: which view the URL hash
 * points at, progress kept in the browser, and the in-codelab search.
 */

import type { Codelab } from "@/lib/contracts/forge-design";

import { parseBlocks, walkBlocks } from "./markdown/blocks";

/** Home page (no hash), a step (`#<stepId>`), or the end page (`#_end`, never a step id). */
export type View = { kind: "home" } | { kind: "step"; index: number } | { kind: "end" };

export const END_HASH = "_end";

export function viewFromHash(hash: string, codelab: Codelab): View {
  const raw = decodeURIComponent((hash || "").replace(/^#/, "")).trim();
  if (!raw) return { kind: "home" };
  if (raw === END_HASH) return { kind: "end" };
  const index = codelab.steps.findIndex((step) => step.id === raw);
  return index >= 0 ? { kind: "step", index } : { kind: "home" };
}

export function hashOfView(view: View, codelab: Codelab): string {
  if (view.kind === "home") return "";
  if (view.kind === "end") return `#${END_HASH}`;
  const step = codelab.steps[view.index];
  return step ? `#${encodeURIComponent(step.id)}` : "";
}

export function nextView(view: View, codelab: Codelab): View {
  const count = codelab.steps.length;
  if (view.kind === "home") return count ? { kind: "step", index: 0 } : { kind: "end" };
  if (view.kind === "step") return view.index + 1 < count ? { kind: "step", index: view.index + 1 } : { kind: "end" };
  return view;
}

export function previousView(view: View, codelab: Codelab): View {
  if (view.kind === "step") return view.index > 0 ? { kind: "step", index: view.index - 1 } : { kind: "home" };
  if (view.kind === "end") {
    const count = codelab.steps.length;
    return count ? { kind: "step", index: count - 1 } : { kind: "home" };
  }
  return view;
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
