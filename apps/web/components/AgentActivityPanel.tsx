"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  FilePenLine,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AgentStep = {
  id: string;
  label: string;
  status: "running" | "done" | "error" | string;
  /** Client-side wall clock, filled when the step first appears. */
  startedAt?: number;
  endedAt?: number;
};

export type FileOp = { op: string; path: string };

export type AgentWarning = { code?: string; message: string; path?: string };

type Props = {
  steps?: AgentStep[];
  thinking?: string;
  fileOps?: FileOp[] | string[];
  warnings?: AgentWarning[];
  effortLabel?: string | null;
  streaming?: boolean;
  /** Live turn: expanded. Historic turn: collapsed, to keep the thread readable. */
  live?: boolean;
  onOpenFile?: (path: string) => void;
};

type NormalizedOp = {
  key: string;
  kind: "write" | "delete";
  path: string;
};

const OPS_VISIBLE = 6;

function normalizeOps(ops: Props["fileOps"]): NormalizedOp[] {
  if (!ops?.length) return [];
  return ops.map((op, index) => {
    if (typeof op === "string") {
      return { key: `${index}:${op}`, kind: "write" as const, path: op };
    }
    return {
      key: `${index}:${op.op}:${op.path}`,
      kind: op.op === "delete" ? ("delete" as const) : ("write" as const),
      path: op.path,
    };
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 100)) / 10}s`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Track first-seen / completion time per step id, so we can show durations. */
function useStepTimings(steps: AgentStep[]) {
  const timings = useRef<Map<string, { start: number; end?: number }>>(new Map());
  const [, force] = useState(0);

  useEffect(() => {
    let changed = false;
    for (const step of steps) {
      const entry = timings.current.get(step.id);
      if (!entry) {
        timings.current.set(step.id, { start: Date.now() });
        changed = true;
      } else if (step.status !== "running" && entry.end === undefined) {
        entry.end = Date.now();
        changed = true;
      }
    }
    if (changed) force((n) => n + 1);
  }, [steps]);

  return timings.current;
}

export function AgentActivityPanel({
  steps = [],
  thinking = "",
  fileOps,
  warnings = [],
  effortLabel,
  streaming = false,
  live = false,
  onOpenFile,
}: Props) {
  const { t } = useI18n();
  // Historic turns start collapsed: previously everything stayed expanded
  // forever, which made the thread unreadable after a few turns.
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(live);
  const [opsExpanded, setOpsExpanded] = useState(false);
  const thinkingRef = useRef<HTMLPreElement>(null);

  const ops = useMemo(() => normalizeOps(fileOps), [fileOps]);
  const timings = useStepTimings(steps);

  // Follow the reasoning as it streams instead of letting it scroll out of the
  // 160px box unnoticed.
  useEffect(() => {
    if (!streaming || !thinkingOpen) return;
    const el = thinkingRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking, streaming, thinkingOpen]);

  useEffect(() => {
    if (live) setStepsOpen(true);
  }, [live]);

  if (
    !steps.length &&
    !thinking &&
    !ops.length &&
    !warnings.length &&
    !effortLabel &&
    !streaming
  ) {
    return null;
  }

  const doneSteps = steps.filter((s) => s.status === "done").length;
  const errorSteps = steps.filter((s) => s.status === "error").length;
  const totalMs = steps.reduce((acc, s) => {
    const entry = timings.get(s.id);
    if (!entry?.end) return acc;
    return acc + (entry.end - entry.start);
  }, 0);

  const stepsSummary = errorSteps
    ? t("agentStepsSummaryError").replace("{n}", String(errorSteps))
    : t("agentStepsSummary")
        .replace("{n}", String(doneSteps))
        .replace("{d}", totalMs > 0 ? formatDuration(totalMs) : "—");

  const visibleOps = opsExpanded ? ops : ops.slice(0, OPS_VISIBLE);

  return (
    <div className="agent-activity">
      {effortLabel ? (
        <div className="agent-activity-meta">
          <span className="agent-effort">{effortLabel}</span>
        </div>
      ) : null}

      {steps.length > 0 && (
        <div className="agent-block">
          <button
            type="button"
            className="agent-block-toggle"
            onClick={() => setStepsOpen((v) => !v)}
            aria-expanded={stepsOpen}
          >
            <Icon icon={stepsOpen ? ChevronDown : ChevronRight} className="ui-icon-sm" />
            <span>{t("agentSteps")}</span>
            {!stepsOpen ? <span className="agent-block-summary">{stepsSummary}</span> : null}
          </button>
          {stepsOpen && (
            <ol className="agent-steps">
              {steps.map((step) => {
                const entry = timings.get(step.id);
                const elapsed =
                  entry?.end !== undefined ? formatDuration(entry.end - entry.start) : null;
                return (
                  <li key={step.id} className={`agent-step agent-step-${step.status}`}>
                    <span className="agent-step-rail" aria-hidden="true" />
                    {step.status === "running" ? (
                      <span className="agent-step-pulse" aria-hidden="true" />
                    ) : step.status === "error" ? (
                      <Icon icon={CircleAlert} className="ui-icon-sm" />
                    ) : (
                      <Icon icon={Check} className="ui-icon-sm" />
                    )}
                    <span className="agent-step-label">{step.label}</span>
                    {elapsed ? <span className="agent-step-time">{elapsed}</span> : null}
                  </li>
                );
              })}
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
            aria-expanded={thinkingOpen}
          >
            <Icon icon={thinkingOpen ? ChevronDown : ChevronRight} className="ui-icon-sm" />
            <span>{t("agentThinkingLabel")}</span>
          </button>
          {thinkingOpen && (
            <pre className="agent-thinking" ref={thinkingRef}>
              {thinking}
            </pre>
          )}
        </div>
      ) : null}

      {ops.length > 0 && (
        <ul className="builder-file-ops">
          {visibleOps.map((op) => {
            const Tag = onOpenFile ? "button" : "span";
            return (
              <li key={op.key} className={`file-op file-op-${op.kind}`}>
                <Icon
                  icon={op.kind === "delete" ? Trash2 : FilePlus2}
                  className="ui-icon-sm"
                />
                <Tag
                  {...(onOpenFile
                    ? {
                        type: "button" as const,
                        onClick: () => onOpenFile(op.path),
                        title: t("fileOpOpen"),
                      }
                    : {})}
                  className="file-op-path"
                >
                  {op.path}
                </Tag>
              </li>
            );
          })}
          {ops.length > OPS_VISIBLE && (
            <li className="file-op-more">
              <button type="button" onClick={() => setOpsExpanded((v) => !v)}>
                {opsExpanded
                  ? t("fileOpsLess")
                  : t("fileOpsMore").replace("{n}", String(ops.length - OPS_VISIBLE))}
              </button>
            </li>
          )}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="agent-warnings">
          {warnings.map((w, i) => (
            <li key={`${w.code || "warn"}-${i}`} className="agent-warning">
              <Icon icon={TriangleAlert} className="ui-icon-sm" />
              <span>
                {w.path ? <code>{w.path}</code> : null} {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kept for the "modified" icon import to stay referenced by the design system. */
export const FILE_OP_ICONS = { write: FilePlus2, edit: FilePenLine, delete: Trash2 };
