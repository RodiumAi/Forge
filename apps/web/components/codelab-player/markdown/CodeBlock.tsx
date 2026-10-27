"use client";

import { Check, Copy, Download, FileCode2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useRenderEnv } from "../context";
import { copyToClipboard, diffCopyText, diffLines, downloadText, type DiffKind } from "./copy";
import { languageLabel, type FenceInfo } from "./fence";
import { tokenize, type Token } from "./highlight";

/** Blocks longer than this collapse by default (unless `nocollapse`). */
export const COLLAPSE_AFTER = 30;
/** Lines left visible when collapsed. */
export const COLLAPSED_LINES = 20;

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useRenderEnv();
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);
  const text_ = state === "copied" ? t("copied") : state === "failed" ? t("copyFailed") : (label ?? t("copy"));
  return (
    <button
      type="button"
      className="fcl-btn fcl-btn-ghost"
      data-state={state}
      aria-live="polite"
      onClick={async () => setState((await copyToClipboard(text)) ? "copied" : "failed")}
    >
      {state === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span>{text_}</span>
    </button>
  );
}

function tokenStyle(token: Token): CSSProperties | undefined {
  if (!token.color && !token.fontStyle) return undefined;
  const style: CSSProperties = {};
  if (token.color) style.color = token.color;
  // Shiki FontStyle bit flags: 1 italic, 2 bold, 4 underline.
  if (token.fontStyle && token.fontStyle & 1) style.fontStyle = "italic";
  if (token.fontStyle && token.fontStyle & 2) style.fontWeight = 600;
  if (token.fontStyle && token.fontStyle & 4) style.textDecoration = "underline";
  return style;
}

/** Lines of tokens for a block, plain until Shiki answers. */
export function useTokens(code: string, lang: string): Token[][] | null {
  const [tokens, setTokens] = useState<{ key: string; lines: Token[][] } | null>(null);
  const key = `${lang}\u0000${code}`;
  useEffect(() => {
    let alive = true;
    void tokenize(code, lang).then((lines) => {
      if (alive && lines) setTokens({ key, lines });
    });
    return () => {
      alive = false;
    };
  }, [code, lang, key]);
  return tokens && tokens.key === key ? tokens.lines : null;
}

type Row = { text: string; kind?: DiffKind; sign?: string };

export function CodeBlock({ fence, code }: { fence: FenceInfo; code: string }) {
  const { t, assetUrl, print } = useRenderEnv();
  const rows: Row[] = useMemo(
    () => (fence.diff ? diffLines(code) : code.split("\n").map((text) => ({ text }))),
    [code, fence.diff],
  );
  // Diff blocks are highlighted without their sign column so tokens line up.
  const source = useMemo(() => rows.map((row) => row.text).join("\n"), [rows]);
  const lang = fence.diff && (fence.lang === "diff" || !fence.lang) ? "" : fence.lang;
  const tokens = useTokens(source, lang);
  const copyText = fence.diff ? diffCopyText(code) : code;
  const collapsible = fence.collapse === true || (fence.collapse !== false && rows.length > COLLAPSE_AFTER);
  const [open, setOpen] = useState(!collapsible || !!print);
  const visible = open ? rows : rows.slice(0, COLLAPSED_LINES);
  const filename = fence.title || (fence.download ? fence.download.split("/").pop() : undefined);
  const langLabel = languageLabel(fence.diff && lang ? lang : fence.lang || (fence.diff ? "diff" : ""));

  return (
    <figure className="fcl-code" data-lang={fence.lang || undefined} data-diff={fence.diff || undefined}>
      <figcaption className="fcl-code-head">
        <span className="fcl-code-file">
          {filename ? <FileCode2 size={14} aria-hidden /> : null}
          {filename ? <span className="fcl-code-name">{filename}</span> : null}
          {langLabel ? <span className="fcl-code-lang">{langLabel}</span> : null}
        </span>
        <span className="fcl-code-actions">
          {fence.download ? (
            <a className="fcl-btn fcl-btn-ghost" href={assetUrl(fence.download)} download={filename}>
              <Download size={14} aria-hidden />
              <span>{t("download")}</span>
            </a>
          ) : fence.title ? (
            <button
              type="button"
              className="fcl-btn fcl-btn-ghost"
              title={t("downloadFile")}
              onClick={() => downloadText(fence.title!, copyText)}
            >
              <Download size={14} aria-hidden />
              <span>{t("download")}</span>
            </button>
          ) : null}
          <CopyButton text={copyText} />
        </span>
      </figcaption>
      <div className="fcl-code-body" data-collapsed={!open || undefined}>
        <pre className="fcl-pre" tabIndex={0}>
          <code>
            {visible.map((row, index) => {
              const number = index + fence.start;
              const highlighted = fence.highlight.has(index + 1);
              return (
                <span
                  key={index}
                  className="fcl-line"
                  data-hl={highlighted || undefined}
                  data-diff={row.kind && row.kind !== "ctx" ? row.kind : undefined}
                >
                  {fence.lineNumbers ? (
                    <span className="fcl-ln" aria-hidden>
                      {number}
                    </span>
                  ) : null}
                  {fence.diff ? (
                    <span className="fcl-sign" aria-hidden>
                      {row.sign || " "}
                    </span>
                  ) : null}
                  <span className="fcl-lc">
                    {tokens?.[index]
                      ? tokens[index].map((token, i) => (
                          <span key={i} style={tokenStyle(token)}>
                            {token.content}
                          </span>
                        ))
                      : row.text}
                    {"\n"}
                  </span>
                </span>
              );
            })}
          </code>
        </pre>
      </div>
      {collapsible ? (
        <button type="button" className="fcl-code-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t("showLess") : t("showMore", { n: rows.length })}
        </button>
      ) : null}
    </figure>
  );
}
