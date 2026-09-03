/**
 * Split an assistant message into prose and file operations.
 *
 * The agent emits `<forge-write path="...">…</forge-write>` and
 * `<forge-delete path="..." />` inline in its answer. Historic messages had
 * those stripped before display, but the live stream showed them raw — a wall
 * of CSS/TSX dumped into the chat. Segments let the UI render prose as markdown
 * and each file operation as a collapsed card.
 *
 * Streaming-aware: a `<forge-write>` whose closing tag has not arrived yet is
 * returned with `complete: false` so the UI can show it as in-progress instead
 * of leaking the opening tag as text.
 */

export type ProseSegment = { kind: "text"; content: string };
export type WriteSegment = {
  kind: "write";
  path: string;
  content: string;
  /** False while the closing tag is still streaming in. */
  complete: boolean;
};
export type DeleteSegment = { kind: "delete"; path: string };
export type MessageSegment = ProseSegment | WriteSegment | DeleteSegment;

const WRITE_OPEN = /<forge-write\s+path=["']([^"']+)["']\s*>/i;
const DELETE_TAG = /<forge-delete\s+path=["']([^"']+)["']\s*\/?>/i;

/** Drop markdown fences the model sometimes wraps file bodies in. */
function stripFences(body: string): string {
  return body
    .trim()
    .replace(/^```[a-zA-Z0-9.+-]*\n?/, "")
    .replace(/\n?```$/, "");
}

function pushText(out: MessageSegment[], buffer: string) {
  const content = buffer.replace(/\n{3,}/g, "\n\n").trim();
  if (content) out.push({ kind: "text", content });
}

/** Drop a PARTIAL forge tag still streaming in at the end of the buffer —
 *  otherwise the chat briefly shows raw `<forge-write path="…` as prose. */
function trimPartialTag(buffer: string): string {
  const lt = buffer.lastIndexOf("<");
  if (lt === -1) return buffer;
  const tail = buffer.slice(lt).toLowerCase();
  if (tail.includes(">")) return buffer; // tag closed — the parser handles it
  const tags = ["<forge-write", "</forge-write", "<forge-delete", "<forge"];
  if (tags.some((tag) => tag.startsWith(tail) || tail.startsWith(tag))) {
    return buffer.slice(0, lt);
  }
  return buffer;
}

export function splitMessageSegments(raw: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  let rest = raw || "";
  let text = "";

  while (rest) {
    const write = rest.match(WRITE_OPEN);
    const del = rest.match(DELETE_TAG);

    // Whichever tag comes first in the remaining buffer.
    const writeAt = write?.index ?? Infinity;
    const delAt = del?.index ?? Infinity;
    if (writeAt === Infinity && delAt === Infinity) {
      text += trimPartialTag(rest);
      break;
    }

    if (delAt < writeAt) {
      text += rest.slice(0, delAt);
      pushText(out, text);
      text = "";
      out.push({ kind: "delete", path: del![1].trim().replace(/^\.\//, "") });
      rest = rest.slice(delAt + del![0].length);
      continue;
    }

    text += rest.slice(0, writeAt);
    pushText(out, text);
    text = "";

    const afterOpen = rest.slice(writeAt + write![0].length);
    const closeAt = afterOpen.search(/<\/forge-write\s*>/i);
    const path = write![1].trim().replace(/^\.\//, "");

    if (closeAt === -1) {
      // Still streaming: everything left belongs to this file.
      out.push({ kind: "write", path, content: stripFences(afterOpen), complete: false });
      return out;
    }

    out.push({
      kind: "write",
      path,
      content: stripFences(afterOpen.slice(0, closeAt)),
      complete: true,
    });
    rest = afterOpen.slice(closeAt).replace(/^<\/forge-write\s*>/i, "");
  }

  pushText(out, text);
  return out;
}

/** Language hint for syntax highlighting, from the file extension. */
export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    tsx: "tsx",
    ts: "typescript",
    jsx: "jsx",
    js: "javascript",
    mjs: "javascript",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    md: "markdown",
    svg: "xml",
    yml: "yaml",
    yaml: "yaml",
  };
  return map[ext] || "";
}
