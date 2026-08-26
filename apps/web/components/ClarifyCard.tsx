"use client";

import { type ReactNode, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ClarifyOption = { id: string; label: string };
export type ClarifyQuestion = {
  id: string;
  prompt: string;
  options: ClarifyOption[];
  connector_id?: string;
  href?: string;
};

type Props = {
  questions: ClarifyQuestion[];
  busy?: boolean;
  onSubmit: (answers: Record<string, string>) => void;
};

/** Lightweight inline markdown: **bold** and `code` (no HTML injection). */
function formatInlineMarkdown(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={`c-${key++}`}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(token);
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length === 1 ? nodes[0] : nodes;
}

export function ClarifyCard({ questions, busy = false, onSubmit }: Props) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered =
    questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));

  return (
    <div className="clarify-card">
      <p className="clarify-card-title">{t("clarifyTitle")}</p>
      <div className="clarify-questions">
        {questions.map((q) => (
          <fieldset key={q.id} className="clarify-question" disabled={busy}>
            <legend>{formatInlineMarkdown(q.prompt)}</legend>
            {q.href ? (
              <p className="clarify-connector-link">
                <a href={q.href} target="_blank" rel="noreferrer">
                  {t("connectorsOpenSettings")}
                </a>
              </p>
            ) : null}
            <div className="clarify-options">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`clarify-option${selected ? " selected" : ""}`}
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                      if (opt.id === "goto" && q.href) {
                        window.open(q.href, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    {formatInlineMarkdown(opt.label)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        className="btn clarify-submit"
        disabled={!allAnswered || busy}
        onClick={() => onSubmit(answers)}
      >
        {busy ? t("clarifySubmitting") : t("clarifyContinue")}
      </button>
    </div>
  );
}
