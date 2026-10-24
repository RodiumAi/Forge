/**
 * Shiki, loaded lazily: the core and the JavaScript regex engine (no WASM)
 * come with the first code block, each grammar only when a block uses it.
 *
 * Colours are CSS variables (`--shiki-token-*`), so the light and dark
 * palettes live in the player's stylesheet and follow the design system
 * tokens instead of a fixed VS Code theme.
 */

import type { HighlighterCore, ThemedToken } from "shiki/core";

type LangModule = { default: unknown };

/** Grammars the player knows, keyed by their Shiki id. Static imports so bundlers split them. */
const LOADERS: Record<string, () => Promise<LangModule>> = {
  python: () => import("shiki/langs/python.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  powershell: () => import("shiki/langs/powershell.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  dart: () => import("shiki/langs/dart.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  dotenv: () => import("shiki/langs/dotenv.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  prisma: () => import("shiki/langs/prisma.mjs"),
  vue: () => import("shiki/langs/vue.mjs"),
  svelte: () => import("shiki/langs/svelte.mjs"),
};

const ALIASES: Record<string, string> = {
  py: "python",
  python3: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  node: "javascript",
  ts: "typescript",
  mts: "typescript",
  sh: "shellscript",
  bash: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  ps1: "powershell",
  pwsh: "powershell",
  ps: "powershell",
  yml: "yaml",
  rs: "rust",
  kt: "kotlin",
  kts: "kotlin",
  "c++": "cpp",
  cc: "cpp",
  hpp: "cpp",
  h: "c",
  cs: "csharp",
  "c#": "csharp",
  rb: "ruby",
  dockerfile: "docker",
  md: "markdown",
  svg: "xml",
  gql: "graphql",
  env: "dotenv",
  conf: "ini",
  cfg: "ini",
  htm: "html",
};

/** The Shiki grammar for a fence language, or null for plain text. */
export function grammarFor(lang: string): string | null {
  const key = (lang || "").toLowerCase().trim();
  if (!key) return null;
  const id = ALIASES[key] ?? key;
  return id in LOADERS ? id : null;
}

export const THEME_NAME = "forge-codelab";

let highlighter: Promise<HighlighterCore> | null = null;
const loaded = new Map<string, Promise<boolean>>();

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighter) {
    highlighter = (async () => {
      const [{ createHighlighterCore, createCssVariablesTheme }, { createJavaScriptRegexEngine }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
      ]);
      return createHighlighterCore({
        themes: [createCssVariablesTheme({ name: THEME_NAME, variablePrefix: "--shiki-", fontStyle: true })],
        langs: [],
        engine: createJavaScriptRegexEngine({ forgiving: true }),
      });
    })();
    highlighter.catch(() => {
      highlighter = null;
    });
  }
  return highlighter;
}

async function ensureLanguage(core: HighlighterCore, grammar: string): Promise<boolean> {
  let pending = loaded.get(grammar);
  if (!pending) {
    pending = LOADERS[grammar]()
      .then(async (mod) => {
        // Grammar modules export an array of registrations (embedded languages included).
        await core.loadLanguage(mod.default as Parameters<HighlighterCore["loadLanguage"]>[0]);
        return true;
      })
      .catch(() => false);
    loaded.set(grammar, pending);
  }
  return pending;
}

export type Token = { content: string; color?: string; fontStyle?: number };

/** Lines of tokens for `code`, or null when the language is unknown or loading failed. */
export async function tokenize(code: string, lang: string): Promise<Token[][] | null> {
  const grammar = grammarFor(lang);
  if (!grammar) return null;
  try {
    const core = await getHighlighter();
    if (!(await ensureLanguage(core, grammar))) return null;
    const lines: ThemedToken[][] = core.codeToTokensBase(code, { lang: grammar, theme: THEME_NAME });
    return lines.map((line) => line.map((token) => ({ content: token.content, color: token.color, fontStyle: token.fontStyle })));
  } catch {
    return null;
  }
}

/** For tests: forget the loaded highlighter. */
export function resetHighlighter(): void {
  highlighter = null;
  loaded.clear();
}
