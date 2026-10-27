"use client";

import { SquareTerminal } from "lucide-react";
import { useMemo } from "react";

import { useRenderEnv } from "../context";
import { CopyButton, useTokens } from "./CodeBlock";
import { terminalCopyText, terminalLines } from "./copy";
import type { FenceInfo } from "./fence";

/** Shell session: prompts are not copied, output is dimmed and never copied. */
export function TerminalBlock({ fence, code }: { fence: FenceInfo; code: string }) {
  const { t } = useRenderEnv();
  const lines = useMemo(() => terminalLines(code), [code]);
  const commands = useMemo(
    () => lines.map((line) => (line.kind === "command" ? line.text : "")).join("\n"),
    [lines],
  );
  // Commands are highlighted as shell; output stays plain.
  const tokens = useTokens(commands, "shellscript");
  return (
    <figure className="fcl-code fcl-terminal">
      <figcaption className="fcl-code-head">
        <span className="fcl-code-file">
          <SquareTerminal size={14} aria-hidden />
          <span className="fcl-code-name">{fence.title || t("terminal")}</span>
        </span>
        <span className="fcl-code-actions">
          <CopyButton text={terminalCopyText(code)} />
        </span>
      </figcaption>
      <div className="fcl-code-body">
        <pre className="fcl-pre" tabIndex={0}>
          <code>
            {lines.map((line, index) => (
              <span key={index} className="fcl-line" data-term={line.kind}>
                {line.kind === "command" && line.prompt ? (
                  <span className="fcl-prompt" aria-hidden>
                    {line.prompt}{" "}
                  </span>
                ) : null}
                <span className="fcl-lc">
                  {line.kind === "command" && tokens?.[index]
                    ? tokens[index].map((token, i) => (
                        <span key={i} style={token.color ? { color: token.color } : undefined}>
                          {token.content}
                        </span>
                      ))
                    : line.text}
                  {"\n"}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
