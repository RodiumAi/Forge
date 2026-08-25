"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Check, CircleAlert } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AgentStep = {
  id: string;
  label: string;
  status: "running" | "done" | "error" | string;
};

export type FileOp = { op: string; path: string };

type Props = {
  steps?: AgentStep[];
  thinking?: string;
  fileOps?: FileOp[] | string[];
  effortLabel?: string | null;
  streaming?: boolean;
};

function normalizeOps(ops: Props["fileOps"]): string[] {
  if (!ops?.length) return [];
  return ops.map((op) => {
    if (typeof op === "string") return op;
    const prefix = op.op === "delete" ? "−" : "+";
    return `${prefix} ${op.path}`;
  });
}

export function AgentActivityPanel({
  steps = [],
  thinking = "",
  fileOps,
  effortLabel,
  streaming = false,
}: Props) {
  const { t } = useI18n();
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(true);
  const ops = normalizeOps(fileOps);

  if (!steps.length && !thinking && !ops.length && !effortLabel && !streaming) {
    return null;
  }

  return (
    <div className="agent-activity">
      {(effortLabel || streaming) && (
        <div className="agent-activity-meta">
          {streaming ? (
            <span className="agent-activity-live">
              <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
              {t("agentThinking")}
            </span>
          ) : null}
          {effortLabel ? <span className="agent-effort">{effortLabel}</span> : null}
        </div>
      )}

      {steps.length > 0 && (
        <div className="agent-block">
          <button
            type="button"
            className="agent-block-toggle"
            onClick={() => setStepsOpen((v) => !v)}
          >
            <Icon icon={stepsOpen ? ChevronDown : ChevronRight} className="ui-icon-sm" />
            {t("agentSteps")}
          </button>
          {stepsOpen && (
            <ol className="agent-steps">
              {steps.map((step) => (
                <li key={step.id} className={`agent-step agent-step-${step.status}`}>
                  {step.status === "running" ? (
                    <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
                  ) : step.status === "error" ? (
                    <Icon icon={CircleAlert} className="ui-icon-sm" />
                  ) : (
                    <Icon icon={Check} className="ui-icon-sm" />
                  )}
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {thinking ? (
        <div className="agent-block">
          <button
            type="button"
            className="agent-block-toggle"
            onClick={() => setThinkingOpen((v) => !v)}
          >
            <Icon icon={thinkingOpen ? ChevronDown : ChevronRight} className="ui-icon-sm" />
            {t("agentThinkingLabel")}
          </button>
          {thinkingOpen && <pre className="agent-thinking">{thinking}</pre>}
        </div>
      ) : null}

      {ops.length > 0 && (
        <ul className="builder-file-ops">
          {ops.map((op) => (
            <li key={op}>{op}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
