/**
 * Small, dependency free code highlighter for code elements: comments,
 * strings, numbers and common keywords. Good enough for slides, tiny in the
 * published bundle.
 */

export type CodeTokenKind = "plain" | "comment" | "string" | "number" | "keyword";
export type CodeToken = { kind: CodeTokenKind; text: string };

const KEYWORDS = new Set(
  (
    "abstract and as async await break case catch class const continue def default defer del delete do elif else enum " +
    "except export extends false final finally fn for from func function go if impl import in interface is lambda let " +
    "match mod mut new nil none not null or package pass private protected pub public raise return self static struct " +
    "super switch this throw throws trait true try type typeof use val var void where while with yield None True False"
  ).split(" "),
);

const HASH_COMMENT = new Set(["python", "py", "ruby", "rb", "bash", "sh", "shell", "zsh", "yaml", "yml", "toml", "r", "perl", "dockerfile", "makefile", "powershell", "ps1"]);

/** Tokens of one line. Block comments are not tracked across lines. */
export function highlightLine(line: string, language?: string): CodeToken[] {
  const lang = (language ?? "").toLowerCase();
  const hash = HASH_COMMENT.has(lang);
  const slash = !hash || lang === "powershell";
  const tokens: CodeToken[] = [];
  const push = (kind: CodeTokenKind, text: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ kind, text });
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if ((hash && rest.startsWith("#")) || (slash && rest.startsWith("//")) || (lang === "sql" && rest.startsWith("--"))) {
      push("comment", rest);
      break;
    }
    if (slash && rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      const text = end < 0 ? rest : rest.slice(0, end + 2);
      push("comment", text);
      i += text.length;
      continue;
    }
    const ch = line[i];
    if (ch === "\"" || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1;
      const text = line.slice(i, Math.min(j + 1, line.length));
      push("string", text);
      i += text.length;
      continue;
    }
    const num = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(rest);
    if (num && !/[A-Za-z0-9_$]/.test(line[i - 1] ?? "")) {
      push("number", num[0]);
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest);
    if (word) {
      push(KEYWORDS.has(word[0]) ? "keyword" : "plain", word[0]);
      i += word[0].length;
      continue;
    }
    push("plain", ch);
    i += 1;
  }
  return tokens;
}

/** "1,3-5" to the set {1, 3, 4, 5} (1 based line numbers). */
export function parseHighlight(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-").map((n) => Number(n));
    if (!Number.isFinite(a)) continue;
    const end = Number.isFinite(b) ? Math.min(b, a + 1000) : a;
    for (let n = a; n <= end; n++) out.add(n);
  }
  return out;
}

export const CODE_COLORS: Record<CodeTokenKind, string> = {
  plain: "#E6EDF3",
  comment: "#8B949E",
  string: "#A5D6FF",
  number: "#79C0FF",
  keyword: "#FF7B72",
};
