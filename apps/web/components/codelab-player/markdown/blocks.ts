/**
 * Extended Markdown of a codelab step, split into blocks.
 *
 * Prose stays plain Markdown (rendered by react-markdown with HTML skipped);
 * the codelab extensions are found here, line by line, so no HTML ever goes
 * through the pipeline:
 *
 * - fenced code (```` ```lang title="x" {1-3} ````), with the special languages
 *   `terminal` (also `console`, `shell-session`), `tree` and `download`;
 * - callouts `:::info Title` ... `:::` (info, tip, warning, danger and aliases);
 * - tab groups `:::tabs group="lang"` ... `:::`, one tab per fenced block or
 *   one per `@tab Label` marker.
 *
 * A container closes on a line of at least as many colons as it opened with;
 * nested containers count their own opening lines.
 */

import { parseFenceInfo, tabLabel, type FenceInfo } from "./fence";

export type CalloutKind = "info" | "tip" | "warning" | "danger";

export type Tab = { label: string; blocks: Block[] };

export type Block =
  | { type: "markdown"; text: string }
  | { type: "code"; fence: FenceInfo; code: string }
  | { type: "terminal"; fence: FenceInfo; code: string }
  | { type: "tree"; fence: FenceInfo; code: string }
  | { type: "download"; items: string[] }
  | { type: "callout"; kind: CalloutKind; title?: string; blocks: Block[] }
  | { type: "tabs"; group: string; tabs: Tab[] };

const CALLOUT_ALIASES: Record<string, CalloutKind> = {
  info: "info",
  note: "info",
  tip: "tip",
  success: "tip",
  positive: "tip",
  warning: "warning",
  caution: "warning",
  negative: "warning",
  danger: "danger",
  error: "danger",
};

const TERMINAL_LANGS = new Set(["terminal", "console", "shell-session", "shellsession"]);
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const CONTAINER_OPEN = /^ {0,3}(:{3,})\s*([A-Za-z][\w-]*)(.*)$/;
const CONTAINER_CLOSE = /^ {0,3}(:{3,})\s*$/;
const TAB_MARKER = /^ {0,3}@tab\s+(.+?)\s*$/;
const MAX_DEPTH = 6;

export function calloutKind(name: string): CalloutKind | null {
  return CALLOUT_ALIASES[name.toLowerCase()] ?? null;
}

function isContainerName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "tabs" || calloutKind(lower) !== null;
}

/** Index just past the closing fence of the block opened at `start` (or the end). */
function fenceEnd(lines: string[], start: number): number {
  const open = FENCE_OPEN.exec(lines[start]);
  if (!open) return start + 1;
  const marker = open[2];
  const close = new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
  for (let i = start + 1; i < lines.length; i += 1) {
    if (close.test(lines[i])) return i + 1;
  }
  return lines.length;
}

/** Index of the line closing the container opened at `start`, or -1. */
function containerEnd(lines: string[], start: number, colons: number): number {
  let depth = 0;
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE_OPEN.test(line)) {
      i = fenceEnd(lines, i);
      continue;
    }
    const open = CONTAINER_OPEN.exec(line);
    if (open && isContainerName(open[2])) {
      depth += 1;
    } else {
      const close = CONTAINER_CLOSE.exec(line);
      if (close) {
        if (depth > 0) depth -= 1;
        else if (close[1].length >= colons) return i;
      }
    }
    i += 1;
  }
  return -1;
}

function attr(rest: string, name: string): string | undefined {
  const match = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|(\\S+))`).exec(rest);
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim() || undefined;
}

function fenceBlock(lines: string[], start: number, end: number): Block {
  const open = FENCE_OPEN.exec(lines[start])!;
  const indent = open[1].length;
  const fence = parseFenceInfo(open[3]);
  const closed = end - 1 > start && new RegExp(`^ {0,3}[${open[2][0]}]{${open[2].length},}\\s*$`).test(lines[end - 1]);
  const body = lines.slice(start + 1, closed ? end - 1 : end).map((line) => {
    // Content indented like its fence loses that indentation (CommonMark).
    let cut = 0;
    while (cut < indent && line[cut] === " ") cut += 1;
    return line.slice(cut);
  });
  const code = body.join("\n");
  if (TERMINAL_LANGS.has(fence.lang)) return { type: "terminal", fence, code };
  if (fence.lang === "tree") return { type: "tree", fence, code };
  if (fence.lang === "download" || fence.lang === "downloads") {
    return {
      type: "download",
      items: body.map((line) => line.trim()).filter((line) => line && !line.startsWith("#")),
    };
  }
  return { type: "code", fence, code };
}

function splitTabs(lines: string[], group: string | undefined, depth: number): Block {
  const markers: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (FENCE_OPEN.test(lines[i])) {
      i = fenceEnd(lines, i) - 1;
      continue;
    }
    if (TAB_MARKER.test(lines[i])) markers.push(i);
  }
  const tabs: Tab[] = [];
  if (markers.length) {
    markers.forEach((at, index) => {
      const label = TAB_MARKER.exec(lines[at])![1];
      const end = index + 1 < markers.length ? markers[index + 1] : lines.length;
      tabs.push({ label, blocks: parseLines(lines.slice(at + 1, end), depth + 1) });
    });
  } else {
    // One tab per fenced block; prose between blocks goes with the next one.
    let pending: Block[] = [];
    for (const block of parseLines(lines, depth + 1)) {
      if (block.type === "code" || block.type === "terminal" || block.type === "tree") {
        tabs.push({ label: tabLabel(block.fence), blocks: [...pending, block] });
        pending = [];
      } else {
        pending.push(block);
      }
    }
    if (pending.length) {
      if (tabs.length) tabs[tabs.length - 1].blocks.push(...pending);
      else tabs.push({ label: "1", blocks: pending });
    }
  }
  // Duplicate labels would make the remembered choice ambiguous.
  const seen = new Map<string, number>();
  for (const tab of tabs) {
    const count = (seen.get(tab.label) ?? 0) + 1;
    seen.set(tab.label, count);
    if (count > 1) tab.label = `${tab.label} (${count})`;
  }
  return { type: "tabs", group: group || tabs.map((tab) => tab.label).join("|"), tabs };
}

function parseLines(lines: string[], depth: number): Block[] {
  const blocks: Block[] = [];
  let prose: string[] = [];
  const flush = () => {
    const text = prose.join("\n");
    if (text.trim()) blocks.push({ type: "markdown", text });
    prose = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE_OPEN.test(line)) {
      flush();
      const end = fenceEnd(lines, i);
      blocks.push(fenceBlock(lines, i, end));
      i = end;
      continue;
    }
    const open = depth < MAX_DEPTH ? CONTAINER_OPEN.exec(line) : null;
    if (open && isContainerName(open[2])) {
      const end = containerEnd(lines, i, open[1].length);
      const inner = lines.slice(i + 1, end === -1 ? lines.length : end);
      const name = open[2].toLowerCase();
      const rest = open[3] ?? "";
      flush();
      if (name === "tabs") {
        blocks.push(splitTabs(inner, attr(rest, "group"), depth));
      } else {
        const title = rest.replace(/\s*\{[^}]*\}\s*$/, "").trim();
        blocks.push({
          type: "callout",
          kind: calloutKind(name)!,
          title: title || undefined,
          blocks: parseLines(inner, depth + 1),
        });
      }
      i = end === -1 ? lines.length : end + 1;
      continue;
    }
    prose.push(line);
    i += 1;
  }
  flush();
  return blocks;
}

/** Split a step's Markdown into blocks. */
export function parseBlocks(markdown: string): Block[] {
  return parseLines((markdown || "").replace(/\r\n?/g, "\n").split("\n"), 0);
}

/** Every code-like block, tabs and callouts included (for search and checks). */
export function walkBlocks(blocks: Block[], visit: (block: Block) => void): void {
  for (const block of blocks) {
    visit(block);
    if (block.type === "callout") walkBlocks(block.blocks, visit);
    if (block.type === "tabs") for (const tab of block.tabs) walkBlocks(tab.blocks, visit);
  }
}

/** First level-1 heading of a step, used as its title when codelab.json has none. */
export function firstHeading(markdown: string): string | null {
  for (const block of parseBlocks(markdown)) {
    if (block.type !== "markdown") continue;
    const match = /^#\s+(.+?)\s*#*\s*$/m.exec(block.text);
    if (match) return match[1];
  }
  return null;
}
