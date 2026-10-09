"use client";

import { type ReactNode, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ClarifyOption = { id: string; label: string };
export type ClarifyQuestion = {
  id: string;
  prompt: string;
  /** "single" (default): one choice. "multiple": several choices apply together. */
  type?: "single" | "multiple";
  options: ClarifyOption[];
};
/** Option id or free text per question; a list of those for a multiple-choice one. */
export type ClarifyAnswers = Record<string, string | string[]>;

type Props = {
  questions: ClarifyQuestion[];
  busy?: boolean;
  onSubmit: (answers: ClarifyAnswers) => void;
};

const isMultiple = (q: ClarifyQuestion) => q.type === "multiple";

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
  // Selected option ids per question (one for single, any number for multiple).
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  // Custom free-text answers per question (always available on top of the
  // suggested options — the questionnaire guides, it never locks in). On a
  // single-choice question it replaces the pick; on a multiple one it adds to it.
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const wizard = questions.length > 3;
  const visible = wizard ? questions.slice(step, step + 1) : questions;
  const current = questions[Math.min(step, Math.max(questions.length - 1, 0))];

  const typed = (qid: string) => (custom[qid] || "").trim();
  const answered = (qid: string) => (picked[qid]?.length ?? 0) > 0 || Boolean(typed(qid));
  const allAnswered = questions.length > 0 && questions.every((q) => answered(q.id));

  function buildAnswers(): ClarifyAnswers {
    const out: ClarifyAnswers = {};
    for (const q of questions) {
      const ids = picked[q.id] ?? [];
      const text = typed(q.id);
      if (isMultiple(q)) {
        out[q.id] = text ? [...ids, text] : [...ids];
      } else {
        out[q.id] = text || ids[0] || "";
      }
    }
    return out;
  }

  function pickOption(q: ClarifyQuestion, optionId: string) {
    if (isMultiple(q)) {
      setPicked((prev) => {
        const cur = prev[q.id] ?? [];
        const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
        return { ...prev, [q.id]: next };
      });
      return;
    }
    setCustom((prev) => ({ ...prev, [q.id]: "" }));
    setPicked((prev) => ({ ...prev, [q.id]: [optionId] }));
  }

  function typeCustom(q: ClarifyQuestion, text: string) {
    setCustom((prev) => ({ ...prev, [q.id]: text }));
    // Typing an answer to a single-choice question replaces the picked option.
    if (!isMultiple(q) && text.trim()) {
      setPicked((prev) => ({ ...prev, [q.id]: [] }));
    }
  }

  function renderQuestion(q: ClarifyQuestion) {
    const multiple = isMultiple(q);
    return (
      <fieldset key={q.id} className="clarify-question" disabled={busy}>
        <legend>{formatInlineMarkdown(q.prompt)}</legend>
        {multiple ? <p className="clarify-hint">{t("clarifyMultiHint")}</p> : null}
        <div className="clarify-options" role={multiple ? "group" : "radiogroup"}>
          {q.options.map((opt) => {
            const selected = (picked[q.id] ?? []).includes(opt.id) && (multiple || !typed(q.id));
            return (
              <button
                key={opt.id}
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={selected}
                className={`clarify-option${multiple ? " is-multi" : ""}${selected ? " selected" : ""}`}
                onClick={() => pickOption(q, opt.id)}
              >
                {formatInlineMarkdown(opt.label)}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          className={`clarify-custom${typed(q.id) ? " selected" : ""}`}
          placeholder={t(multiple ? "clarifyCustomAddPlaceholder" : "clarifyCustomPlaceholder")}
          value={custom[q.id] || ""}
          onChange={(e) => typeCustom(q, e.target.value)}
          aria-label={t(multiple ? "clarifyCustomAddPlaceholder" : "clarifyCustomPlaceholder")}
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
              onClick={() => onSubmit(buildAnswers())}
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
          onClick={() => onSubmit(buildAnswers())}
        >
          {busy ? t("clarifySubmitting") : t("clarifyContinue")}
        </button>
      )}
    </div>
  );
}
