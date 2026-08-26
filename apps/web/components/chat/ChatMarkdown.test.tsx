import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { ChatMarkdown } from "./ChatMarkdown";

describe("markdown rendering", () => {
  it("renders emphasis instead of stripping it", () => {
    // The previous plain-text pipeline destroyed every marker before display.
    const { container } = renderWithProviders(<ChatMarkdown content="**bold** and *italic*" />);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
  });

  it("renders headings and lists", () => {
    const { container } = renderWithProviders(
      <ChatMarkdown content={"## Title\n\n- one\n- two"} />,
    );
    expect(container.querySelector("h2")).toHaveTextContent("Title");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("keeps inline code as code", () => {
    const { container } = renderWithProviders(<ChatMarkdown content="use `useState` here" />);
    expect(container.querySelector("code.md-code-inline")).toHaveTextContent("useState");
  });

  it("renders GFM tables", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const { container } = renderWithProviders(<ChatMarkdown content={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("opens links safely in a new tab", () => {
    const { container } = renderWithProviders(
      <ChatMarkdown content="[docs](https://example.com)" />,
    );
    const link = container.querySelector("a")!;
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});

describe("code blocks", () => {
  const FENCED = "```tsx\nconst a = 1;\n```";

  it("renders a block with its language", () => {
    const { container } = renderWithProviders(<ChatMarkdown content={FENCED} />);
    expect(screen.getByText("tsx")).toBeInTheDocument();
    // Highlighting splits the code across spans, so assert on the flattened text.
    expect(container.querySelector(".md-code-pre")?.textContent).toContain("const a = 1;");
  });

  it("labels an unlabelled block", () => {
    renderWithProviders(<ChatMarkdown content={"```\nplain\n```"} />);
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("copies the block to the clipboard", async () => {
    // userEvent.setup() installs its own clipboard stub, so read it back rather
    // than trying to spy on navigator.clipboard.
    const { user } = renderWithProviders(<ChatMarkdown content={FENCED} />);
    await user.click(screen.getByRole("button", { name: /copy code/i }));

    // Regression: highlighting turns the children into elements, so the old
    // String(children) put "[object Object]" on the clipboard.
    await expect(navigator.clipboard.readText()).resolves.toBe("const a = 1;");
    expect(await screen.findByText("Copié")).toBeInTheDocument();
  });
});

describe("streaming", () => {
  it("closes an unterminated fence so the block renders while it arrives", () => {
    // Without balancing, a half-received block dumped raw backticks and
    // swallowed the rest of the message.
    const { container } = renderWithProviders(
      <ChatMarkdown content={"```tsx\nconst a ="} streaming />,
    );
    expect(container.querySelector(".md-code")).toBeInTheDocument();
    expect(container.textContent).not.toContain("```");
  });

  it("shows a caret while streaming", () => {
    const { container } = renderWithProviders(<ChatMarkdown content="typing" streaming />);
    expect(container.querySelector(".md-caret")).toBeInTheDocument();
  });

  it("hides the caret once finished", () => {
    const { container } = renderWithProviders(<ChatMarkdown content="done" />);
    expect(container.querySelector(".md-caret")).toBeNull();
  });

  it("leaves a balanced fence untouched", () => {
    const { container } = renderWithProviders(
      <ChatMarkdown content={"```\nok\n```"} streaming />,
    );
    expect(container.querySelectorAll(".md-code")).toHaveLength(1);
  });
});
