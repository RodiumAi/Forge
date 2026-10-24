/**
 * What the Copy buttons put on the clipboard, and the line models of diff and
 * terminal blocks (shared by the renderer and the tests).
 */

export type DiffKind = "add" | "del" | "ctx" | "meta";
export type DiffLine = { kind: DiffKind; sign: string; text: string };

/**
 * Lines of a diff block. `+` adds, `-` removes; `+++` / `---` file headers and
 * `@@` hunk headers are metadata (shown, never copied). When every line is
 * signed (unified diff), the leading space of context lines is part of the
 * sign column too.
 */
export function diffLines(code: string): DiffLine[] {
  const lines = code.split("\n");
  const isMeta = (line: string) => line.startsWith("@@") || line.startsWith("+++") || line.startsWith("---");
  const unified = lines.every((line) => line === "" || isMeta(line) || /^[+\- ]/.test(line));
  return lines.map((line) => {
    if (isMeta(line)) return { kind: "meta", sign: "", text: line };
    if (line.startsWith("+") && !line.startsWith("+++")) return { kind: "add", sign: "+", text: line.slice(1) };
    if (line.startsWith("-") && !line.startsWith("---")) return { kind: "del", sign: "-", text: line.slice(1) };
    if (unified && line.startsWith(" ")) return { kind: "ctx", sign: " ", text: line.slice(1) };
    return { kind: "ctx", sign: "", text: line };
  });
}

/** The code after the change: removed lines dropped, signs stripped. */
export function diffCopyText(code: string): string {
  return diffLines(code)
    .filter((line) => line.kind !== "del" && line.kind !== "meta")
    .map((line) => line.text)
    .join("\n");
}

export type TerminalLine = { kind: "command" | "output"; prompt: string; text: string };

const PROMPT_RE = /^(\$|>|PS>|PS [^>]*>|#|%)\s/;

/**
 * Lines of a terminal block. A line starting with a prompt (`$ `, `> `,
 * `PS> `, `# `, `% `) is a command; a command ending in `\` (or a PowerShell
 * backtick) continues on the next line; everything else is output.
 */
export function terminalLines(code: string): TerminalLine[] {
  const out: TerminalLine[] = [];
  let continued = false;
  for (const line of code.split("\n")) {
    if (continued) {
      out.push({ kind: "command", prompt: "", text: line });
      continued = /[\\`]\s*$/.test(line);
      continue;
    }
    const prompt = PROMPT_RE.exec(line);
    if (prompt) {
      const text = line.slice(prompt[0].length);
      out.push({ kind: "command", prompt: prompt[1], text });
      continued = /[\\`]\s*$/.test(text);
    } else {
      out.push({ kind: "output", prompt: "", text: line });
    }
  }
  // A block with no prompt at all is a list of commands.
  if (!out.some((line) => line.kind === "command")) {
    return out.map((line) => (line.text.trim() ? { ...line, kind: "command" } : line));
  }
  return out;
}

/** Commands only, without their prompt, ready to paste in a shell. */
export function terminalCopyText(code: string): string {
  return terminalLines(code)
    .filter((line) => line.kind === "command")
    .map((line) => line.text)
    .join("\n");
}

/** Write to the clipboard; falls back to a hidden textarea (http, old browsers). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Offer `text` as a file download (the snippet itself, when no project file backs it). */
export function downloadText(filename: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.split("/").pop() || "code.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
