/**
 * Info string of a fenced code block, the part after the backticks:
 *
 *   ```py title="main.py" {3-5} download="files/starter/main.py"
 *
 * First word: the language (unless it is an attribute). Then attributes
 * (`key="value"`, `key='value'`, `key=value`), bare flags (`diff`, `collapse`,
 * `nocollapse`, `nolines`) and highlighted line ranges in braces.
 */

export type FenceInfo = {
  /** Lower-case language as written ("" when none). */
  lang: string;
  title?: string;
  /** Tab label inside a tab group (falls back to title, then language). */
  label?: string;
  /** Path under files/ offered by the Download button. */
  download?: string;
  /** 1-based line numbers to highlight. */
  highlight: Set<number>;
  diff: boolean;
  /** true: collapse, false: never, undefined: by length. */
  collapse?: boolean;
  lineNumbers: boolean;
  /** First line number shown (default 1). */
  start: number;
};

const ATTR_RE = /([A-Za-z][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))|\{([\d,\s-]+)\}|(\S+)/g;
const MAX_RANGE_LINES = 5000;

/** "3-5,8" or "{3-5, 8}" to a set of line numbers. Invalid parts are ignored. */
export function parseLineRanges(raw: string): Set<number> {
  const out = new Set<number>();
  for (const part of raw.replace(/[{}]/g, "").split(",")) {
    const text = part.trim();
    if (!text) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(text);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > 0 && to >= from && to - from < MAX_RANGE_LINES) {
        for (let n = from; n <= to; n += 1) out.add(n);
      }
      continue;
    }
    if (/^\d+$/.test(text) && Number(text) > 0) out.add(Number(text));
  }
  return out;
}

export function parseFenceInfo(info: string): FenceInfo {
  const result: FenceInfo = { lang: "", highlight: new Set(), diff: false, lineNumbers: true, start: 1 };
  const raw = (info || "").trim();
  let first = true;
  for (const match of raw.matchAll(ATTR_RE)) {
    const [, key, dq, sq, bare, ranges, word] = match;
    if (ranges !== undefined) {
      for (const n of parseLineRanges(ranges)) result.highlight.add(n);
      first = false;
      continue;
    }
    if (key) {
      const value = (dq ?? sq ?? bare ?? "").trim();
      const name = key.toLowerCase();
      if (name === "title" || name === "filename" || name === "file") result.title = value || undefined;
      else if (name === "label" || name === "tab") result.label = value || undefined;
      else if (name === "download") result.download = value || undefined;
      else if (name === "lang" || name === "language") result.lang = value.toLowerCase();
      else if (name === "highlight" || name === "hl" || name === "lines") {
        for (const n of parseLineRanges(value)) result.highlight.add(n);
      } else if (name === "start" || name === "startline") {
        const n = Number(value);
        if (Number.isInteger(n) && n > 0 && n < 1_000_000) result.start = n;
      } else if (name === "collapse") result.collapse = value !== "false";
      first = false;
      continue;
    }
    const flag = (word || "").toLowerCase();
    if (!flag) continue;
    if (first && !["diff", "collapse", "nocollapse", "nolines"].includes(flag)) {
      result.lang = flag;
      first = false;
      continue;
    }
    first = false;
    if (flag === "diff") result.diff = true;
    else if (flag === "collapse") result.collapse = true;
    else if (flag === "nocollapse") result.collapse = false;
    else if (flag === "nolines" || flag === "nolinenumbers") result.lineNumbers = false;
  }
  if (result.lang === "diff") result.diff = true;
  // "diff-python": a diff whose lines are Python.
  const diffLang = /^diff-([a-z0-9+#.-]+)$/.exec(result.lang);
  if (diffLang) {
    result.diff = true;
    result.lang = diffLang[1];
  }
  return result;
}

const LANG_LABELS: Record<string, string> = {
  py: "Python",
  python: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  sh: "Shell",
  bash: "Bash",
  shell: "Shell",
  zsh: "Zsh",
  ps1: "PowerShell",
  powershell: "PowerShell",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  kt: "Kotlin",
  swift: "Swift",
  dart: "Dart",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  cs: "C#",
  csharp: "C#",
  php: "PHP",
  ruby: "Ruby",
  rb: "Ruby",
  dockerfile: "Dockerfile",
  docker: "Dockerfile",
  md: "Markdown",
  markdown: "Markdown",
  xml: "XML",
  graphql: "GraphQL",
  ini: "INI",
  env: "Env",
  diff: "Diff",
  txt: "Texte",
  text: "Texte",
  plaintext: "Texte",
};

/** Human label of a language id ("py" to "Python"). */
export function languageLabel(lang: string): string {
  const key = (lang || "").toLowerCase();
  if (!key) return "";
  return LANG_LABELS[key] ?? key.toUpperCase();
}

/** Label of a tab built from a fenced block. */
export function tabLabel(fence: FenceInfo): string {
  return fence.label || fence.title || languageLabel(fence.lang) || "Code";
}
