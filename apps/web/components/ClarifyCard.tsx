"use client";

import { useState } from "react";
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
            <legend>{q.prompt}</legend>
            <div className="clarify-options">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`clarify-option${selected ? " selected" : ""}`}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                    }
                  >
                    {opt.label}
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
