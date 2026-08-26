"use client";

import { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { Icon } from "@/components/ui/icon";

/**
 * Assistant message renderer.
 *
 * Replaces `toPlainChatText`, which stripped bold, italics, headings, links and
 * even inline code before display — so the model's formatting never reached the
 * user and code was rendered as unreadable prose.
 *
 * Streaming safety: an unterminated ``` fence is closed before parsing, so a
 * half-received code block renders as a code block instead of dumping raw
 * backticks and swallowing the rest of the message.
 */

function balanceFences(md: string): string {
  const fences = (md.match(/^```/gm) || []).length;
  return fences % 2 === 1 ? `${md}\n\`\`\`` : md;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [value]);

  return (
    <button
      type="button"
      className="md-code-copy"
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      <Icon icon={copied ? Check : Copy} size={13} />
      <span>{copied ? "Copié" : "Copier"}</span>
    </button>
  );
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const raw = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className || "")?.[1] || "";

  return (
    <div className="md-code">
      <div className="md-code-head">
        <span className="md-code-lang">{lang || "code"}</span>
        <CopyButton value={raw} />
      </div>
      <pre className="md-code-pre">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const text = streaming ? balanceFences(content) : content;

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          // `pre` is unwrapped: CodeBlock renders its own <pre> with a toolbar.
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...props }) {
            const isBlock = /language-/.test(className || "") || String(children).includes("\n");
            if (!isBlock) {
              return (
                <code className="md-code-inline" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="md-link">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="md-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
      {streaming ? <span className="md-caret" aria-hidden="true" /> : null}
    </div>
  );
});
