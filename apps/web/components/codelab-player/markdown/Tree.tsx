"use client";

import { File, Folder, FolderTree } from "lucide-react";

import { useRenderEnv } from "../context";
import { CopyButton } from "./CodeBlock";
import type { FenceInfo } from "./fence";

export type TreeEntry = { depth: number; name: string; folder: boolean; note?: string; last: boolean; open: boolean[] };

const DRAWING_RE = /^[\s│|├└┬─`\\+-]*/;

/**
 * Lines of a `tree` block. Accepts an indented list (two spaces or a tab per
 * level, an optional "- ") or the output of the `tree` command (box drawing);
 * a name ending in "/" is a folder, `# text` after a name is a note.
 */
export function parseTree(code: string): TreeEntry[] {
  const raw: { depth: number; name: string; note?: string }[] = [];
  for (const line of code.split("\n")) {
    if (!line.trim()) continue;
    const drawn = /[│├└]/.test(line);
    let depth: number;
    let rest: string;
    if (drawn) {
      const prefix = DRAWING_RE.exec(line)?.[0] ?? "";
      depth = Math.max(0, Math.round(prefix.replace(/\t/g, "    ").length / 4));
      rest = line.slice(prefix.length);
    } else {
      const indent = /^[\t ]*/.exec(line)?.[0] ?? "";
      depth = Math.floor(indent.replace(/\t/g, "  ").length / 2);
      rest = line.slice(indent.length).replace(/^[-*]\s+/, "");
    }
    const noteAt = rest.search(/\s#\s/);
    const name = (noteAt >= 0 ? rest.slice(0, noteAt) : rest).trim();
    const note = noteAt >= 0 ? rest.slice(noteAt).replace(/^\s#\s/, "").trim() : undefined;
    if (name) raw.push({ depth, name, note });
  }
  // Clamp jumps (a child two levels deeper than its parent) and mark folders.
  const entries: TreeEntry[] = [];
  raw.forEach((item, index) => {
    const prev = entries[index - 1];
    const depth = prev ? Math.min(item.depth, prev.depth + 1) : 0;
    const next = raw[index + 1];
    const folder = item.name.endsWith("/") || (next !== undefined && next.depth > item.depth);
    entries.push({ depth, name: item.name, note: item.note, folder, last: true, open: [] });
  });
  // `last`: no later sibling; `open[d]`: an ancestor at depth d still has siblings below.
  for (let i = 0; i < entries.length; i += 1) {
    const { depth } = entries[i];
    let last = true;
    for (let j = i + 1; j < entries.length; j += 1) {
      if (entries[j].depth < depth) break;
      if (entries[j].depth === depth) {
        last = false;
        break;
      }
    }
    entries[i].last = last;
  }
  for (let i = 0; i < entries.length; i += 1) {
    const open: boolean[] = [];
    for (let d = 1; d < entries[i].depth; d += 1) {
      // Find the ancestor at depth d and ask whether it has later siblings.
      let ancestor = -1;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (entries[j].depth === d) {
          ancestor = j;
          break;
        }
      }
      open.push(ancestor >= 0 && !entries[ancestor].last);
    }
    entries[i].open = open;
  }
  return entries;
}

export function TreeBlock({ fence, code }: { fence: FenceInfo; code: string }) {
  const { t } = useRenderEnv();
  const entries = parseTree(code);
  return (
    <figure className="fcl-code fcl-tree">
      <figcaption className="fcl-code-head">
        <span className="fcl-code-file">
          <FolderTree size={14} aria-hidden />
          <span className="fcl-code-name">{fence.title || t("tree")}</span>
        </span>
        <span className="fcl-code-actions">
          <CopyButton text={code} />
        </span>
      </figcaption>
      <ul className="fcl-tree-list">
        {entries.map((entry, index) => (
          <li key={index} className="fcl-tree-row" data-depth={entry.depth}>
            <span className="fcl-tree-guides" aria-hidden>
              {entry.open.map((open, d) => (
                <span key={d} className="fcl-tree-guide">
                  {open ? "│   " : "    "}
                </span>
              ))}
              {entry.depth > 0 ? <span className="fcl-tree-guide">{entry.last ? "└── " : "├── "}</span> : null}
            </span>
            {entry.folder ? (
              <Folder size={14} className="fcl-tree-icon" data-folder aria-hidden />
            ) : (
              <File size={14} className="fcl-tree-icon" aria-hidden />
            )}
            <span className="fcl-tree-name" data-folder={entry.folder || undefined}>
              {entry.name}
            </span>
            {entry.note ? <span className="fcl-tree-note">{entry.note}</span> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}
