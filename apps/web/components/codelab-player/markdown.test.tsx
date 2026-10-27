import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultEnv, RenderEnvProvider } from "./context";
import { parseBlocks } from "./markdown/blocks";
import { diffCopyText, diffLines, terminalCopyText, terminalLines } from "./markdown/copy";
import { parseFenceInfo, parseLineRanges } from "./markdown/fence";
import { grammarFor, tokenize } from "./markdown/highlight";
import { CodelabMarkdown } from "./markdown/Markdown";
import { resetTabMemory } from "./markdown/tabs-memory";
import { parseTree } from "./markdown/Tree";

const fence = "```";

describe("fence info", () => {
  it("reads language, title, highlighted ranges and flags", () => {
    const info = parseFenceInfo('py title="main.py" {3-5,8} download="files/starter/main.py"');
    expect(info.lang).toBe("py");
    expect(info.title).toBe("main.py");
    expect([...info.highlight]).toEqual([3, 4, 5, 8]);
    expect(info.download).toBe("files/starter/main.py");
    expect(info.diff).toBe(false);
    expect(info.lineNumbers).toBe(true);
  });

  it("knows diff, collapse and line number flags", () => {
    expect(parseFenceInfo("diff").diff).toBe(true);
    const typed = parseFenceInfo("diff-python");
    expect(typed).toMatchObject({ diff: true, lang: "python" });
    expect(parseFenceInfo("ts diff nolines collapse")).toMatchObject({ lang: "ts", diff: true, lineNumbers: false, collapse: true });
    expect(parseFenceInfo("js nocollapse").collapse).toBe(false);
    expect(parseFenceInfo("{2}").lang).toBe("");
  });

  it("ignores broken ranges", () => {
    expect([...parseLineRanges("{0, 5-3, a, 2}")]).toEqual([2]);
  });
});

describe("block splitter", () => {
  it("separates prose, code, terminal, tree and download blocks", () => {
    const md = [
      "# Titre",
      "",
      "Texte.",
      `${fence}py title="main.py"`,
      "print(1)",
      fence,
      `${fence}terminal`,
      "$ pip install fastapi",
      "Successfully installed",
      fence,
      `${fence}tree`,
      "app/",
      "  main.py",
      fence,
      `${fence}download`,
      "starter",
      fence,
    ].join("\n");
    expect(parseBlocks(md).map((b) => b.type)).toEqual(["markdown", "code", "terminal", "tree", "download"]);
  });

  it("parses callouts, aliases and nested containers", () => {
    const md = [":::tip Bon à savoir", "Contenu", ":::", "::::warning", ":::info", "dedans", ":::", "::::"].join("\n");
    const blocks = parseBlocks(md);
    expect(blocks[0]).toMatchObject({ type: "callout", kind: "tip", title: "Bon à savoir" });
    expect(blocks[1]).toMatchObject({ type: "callout", kind: "warning" });
    expect((blocks[1] as { blocks: { type: string; kind?: string }[] }).blocks[0]).toMatchObject({
      type: "callout",
      kind: "info",
    });
  });

  it("does not open containers inside code fences", () => {
    const blocks = parseBlocks([`${fence}md`, ":::info", "pas un encadré", ":::", fence].join("\n"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("code");
  });

  it("builds one tab per fenced block, or per @tab marker", () => {
    const byFence = parseBlocks(
      [':::tabs group="lang"', `${fence}py title="main.py"`, "x = 1", fence, `${fence}js`, "let x = 1", fence, ":::"].join("\n"),
    );
    expect(byFence[0]).toMatchObject({ type: "tabs", group: "lang" });
    expect((byFence[0] as { tabs: { label: string }[] }).tabs.map((t) => t.label)).toEqual(["main.py", "JavaScript"]);

    const byMarker = parseBlocks([":::tabs", "@tab macOS", "Texte mac", "@tab Windows", "Texte win", ":::"].join("\n"));
    const tabs = (byMarker[0] as { tabs: { label: string; blocks: { type: string }[] }[] }).tabs;
    expect(tabs.map((t) => t.label)).toEqual(["macOS", "Windows"]);
    expect(tabs[0].blocks[0].type).toBe("markdown");
  });

  it("keeps unknown containers as prose", () => {
    expect(parseBlocks(":::bizarre\nx\n:::")[0].type).toBe("markdown");
  });
});

describe("diff and terminal copy", () => {
  const diff = ["@@ -1,3 +1,3 @@", " import os", "-print('a')", "+print('b')", " done"].join("\n");

  it("classifies diff lines and strips the sign column", () => {
    const lines = diffLines(diff);
    expect(lines.map((l) => l.kind)).toEqual(["meta", "ctx", "del", "add", "ctx"]);
    expect(lines[2].text).toBe("print('a')");
  });

  it("copies the code after the change, without signs", () => {
    expect(diffCopyText(diff)).toBe(["import os", "print('b')", "done"].join("\n"));
    expect(diffCopyText("a\n-b\n+c")).toBe("a\nc");
  });

  it("copies terminal commands without prompt nor output", () => {
    const code = ["$ npm install \\", "  --save-dev vitest", "added 12 packages", "$ npm test", "> PASS"].join("\n");
    expect(terminalLines(code).map((l) => l.kind)).toEqual(["command", "command", "output", "command", "command"]);
    expect(terminalCopyText("$ ls\nfile.txt\n$ pwd")).toBe("ls\npwd");
    // No prompt at all: every line is a command.
    expect(terminalCopyText("git status\ngit add .")).toBe("git status\ngit add .");
  });
});

describe("tree", () => {
  it("reads indented lists and tree output", () => {
    const fromList = parseTree("app/\n  main.py  # point d'entrée\n  routes/\n    users.py\nREADME.md");
    expect(fromList.map((e) => [e.depth, e.name, e.folder])).toEqual([
      [0, "app/", true],
      [1, "main.py", false],
      [1, "routes/", true],
      [2, "users.py", false],
      [0, "README.md", false],
    ]);
    expect(fromList[1].note).toBe("point d'entrée");
    const drawn = parseTree(".\n├── src\n│   └── index.ts\n└── package.json");
    expect(drawn.map((e) => [e.depth, e.name])).toEqual([
      [0, "."],
      [1, "src"],
      [2, "index.ts"],
      [1, "package.json"],
    ]);
    expect(drawn[1].folder).toBe(true);
  });
});

describe("highlighting", () => {
  it("maps aliases to the grammars it can load", () => {
    expect(grammarFor("py")).toBe("python");
    expect(grammarFor("sh")).toBe("shellscript");
    expect(grammarFor("txt")).toBeNull();
  });

  it("tokenizes with CSS variable colours", async () => {
    const lines = await tokenize("def f():\n    return 1", "py");
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(2);
    const keyword = lines![0].find((token) => token.content === "def");
    expect(keyword?.color).toMatch(/var\(--shiki-/);
  }, 20000);
});

function renderMd(markdown: string) {
  return render(
    <RenderEnvProvider value={{ ...defaultEnv("fr"), assetUrl: (p) => `/assets/${p}` }}>
      <CodelabMarkdown markdown={markdown} />
    </RenderEnvProvider>,
  );
}

describe("rendering", () => {
  it("renders a code block with header, line numbers and highlights", () => {
    const { container } = renderMd(`${fence}py title="main.py" {2}\na = 1\nb = 2\n${fence}`);
    expect(screen.getByText("main.py")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    const lines = container.querySelectorAll(".fcl-line");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveAttribute("data-hl", "true");
    expect(container.querySelectorAll(".fcl-ln")[1].textContent).toBe("2");
  });

  it("copies with a Copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderMd(`${fence}diff\n-old\n+new\n${fence}`);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier/i }));
    });
    expect(writeText).toHaveBeenCalledWith("new");
    expect(screen.getByText("Copié")).toBeInTheDocument();
  });

  it("marks diff lines and terminal output", () => {
    const { container } = renderMd(`${fence}diff\n-a\n+b\n${fence}\n\n${fence}terminal\n$ ls\nfichier\n${fence}`);
    expect(container.querySelector('[data-diff="del"]')).not.toBeNull();
    expect(container.querySelector('[data-diff="add"]')).not.toBeNull();
    expect(container.querySelector('[data-term="output"]')?.textContent).toContain("fichier");
    expect(container.querySelector(".fcl-prompt")?.textContent).toContain("$");
  });

  it("collapses long blocks and expands them", () => {
    const code = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
    const { container } = renderMd(`${fence}txt\n${code}\n${fence}`);
    expect(container.querySelectorAll(".fcl-line")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: /afficher plus/i }));
    expect(container.querySelectorAll(".fcl-line")).toHaveLength(40);
  });

  it("links a per-file download to the project file", () => {
    renderMd(`${fence}py download="files/starter/main.py"\nx\n${fence}`);
    expect(screen.getByRole("link", { name: /télécharger/i })).toHaveAttribute("href", "/assets/files/starter/main.py");
  });

  it("renders callouts and resolves images through assetUrl", () => {
    const { container } = renderMd(":::danger\nNe faites pas ça.\n:::\n\n![Schéma](public/images/a.webp)");
    expect(container.querySelector('.fcl-callout[data-kind="danger"]')).not.toBeNull();
    expect(screen.getByText("Danger")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Schéma" })).toHaveAttribute("src", "/assets/public/images/a.webp");
  });

  it("drops raw HTML", () => {
    const { container } = renderMd('Texte <script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("remembers the tab choice and syncs groups", async () => {
    resetTabMemory();
    const tabs = (id: string) =>
      [':::tabs group="os"', "@tab macOS", `mac ${id}`, "@tab Windows", `win ${id}`, ":::"].join("\n");
    renderMd(`${tabs("1")}\n\n${tabs("2")}`);
    const windows = screen.getAllByRole("tab", { name: "Windows" });
    fireEvent.click(windows[0]);
    await waitFor(() => {
      for (const tab of screen.getAllByRole("tab", { name: "Windows" })) expect(tab).toHaveAttribute("aria-selected", "true");
    });
    expect(localStorage.getItem("forge-codelab:tabs:os")).toBe("Windows");
  });
});
