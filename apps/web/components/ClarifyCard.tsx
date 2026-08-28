"use client";

import { type ReactNode, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ClarifyOption = { id: string; label: string };
export type ClarifyQuestion = {
  id: string;
  prompt: string;
  options: ClarifyOption[];
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
  // Custom free-text answers per question (always available on top of the
  // suggested options — the questionnaire guides, it never locks in).
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const wizard = questions.length > 3;
  const visible = wizard ? questions.slice(step, step + 1) : questions;
  const current = questions[Math.min(step, Math.max(questions.length - 1, 0))];

  const answered = (qid: string) => Boolean((answers[qid] || "").trim());
  const allAnswered = questions.length > 0 && questions.every((q) => answered(q.id));

  function pickOption(qid: string, optionId: string) {
    setCustom((prev) => ({ ...prev, [qid]: "" }));
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
  }

  function typeCustom(qid: string, text: string) {
    setCustom((prev) => ({ ...prev, [qid]: text }));
    setAnswers((prev) => ({ ...prev, [qid]: text.trim() }));
  }

  function renderQuestion(q: ClarifyQuestion) {
    return (
      <fieldset key={q.id} className="clarify-question" disabled={busy}>
        <legend>{formatInlineMarkdown(q.prompt)}</legend>
        <div className="clarify-options">
          {q.options.map((opt) => {
            const selected = !custom[q.id]?.trim() && answers[q.id] === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`clarify-option${selected ? " selected" : ""}`}
                onClick={() => pickOption(q.id, opt.id)}
              >
                {formatInlineMarkdown(opt.label)}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          className={`clarify-custom${custom[q.id]?.trim() ? " selected" : ""}`}
          placeholder={t("clarifyCustomPlaceholder")}
          value={custom[q.id] || ""}
          onChange={(e) => typeCustom(q.id, e.target.value)}
          aria-label={t("clarifyCustomPlaceholder")}
        />
      </fieldset>
    );
  }

  return (
    <div className="clarify-card">
      <p className="clarify-card-title">{t("clarifyTitle")}</p>

      {wizard && (
        <div className="clarify-progress" aria-label={`${step + 1}/${questions.length}`}>
          <div className="clarify-progress-track" aria-hidden>
            <div
              className="clarify-progress-fill"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="clarify-progress-label">
            {step + 1}/{questions.length}
          </span>
        </div>
      )}

      <div className="clarify-questions">{visible.map(renderQuestion)}</div>

      {wizard ? (
        <div className="clarify-nav">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t("clarifyBack")}
          </button>
          {step < questions.length - 1 ? (
            <button
              type="button"
              className="btn clarify-submit"
              disabled={busy || !current || !answered(current.id)}
              onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
            >
              {t("clarifyNext")}
            </button>
          ) : (
            <button
              type="button"
              className="btn clarify-submit"
              disabled={!allAnswered || busy}
              onClick={() => onSubmit(answers)}
            >
              {busy ? t("clarifySubmitting") : t("clarifyContinue")}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="btn clarify-submit"
          disabled={!allAnswered || busy}
          onClick={() => onSubmit(answers)}
        >
          {busy ? t("clarifySubmitting") : t("clarifyContinue")}
        </button>
      )}
    </div>
  );
}
