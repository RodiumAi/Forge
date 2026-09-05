"use client";

import {
  Check,
  ChevronDown,
  Circle,
  CircleAlert,
  ListTodo,
  Loader2,
  Play,
  Square,
  StepForward,
} from "lucide-react";
import { memo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { FileOp } from "@/components/AgentActivityPanel";

export type PlanTask = {
  id: string;
  title: string;
  status?: "pending" | "running" | "done" | "error" | string;
};

/** LLM-generated display meta for the "Created Plan" card. */
export type PlanMeta = {
  title?: string;
  summary?: string;
};

type Props = {
  tasks: PlanTask[];
  /** Plan title/summary from the planner (Cursor-style header card). */
  meta?: PlanMeta | null;
  needsConfirm?: boolean;
  busy?: boolean;
  executing?: boolean;
  /** File operations of the run; grouped under their task when tagged. */
  ops?: FileOp[];
  onExecute?: () => void;
  /** Execute only the next pending task, then pause (step-by-step mode). */
  onExecuteStep?: () => void;
  onDismiss?: () => void;
  /** Cancel the run mid-execution (Stop button in the footer). */
  onStop?: () => void;
  onOpenFile?: (path: string) => void;
};

function TaskIcon({ status }: { status?: string }) {
  if (status === "running") {
    return <Icon icon={Loader2} className="ui-icon-sm agent-spin plan-task-icon-running" />;
  }
  if (status === "done") {
    return <Icon icon={Check} className="ui-icon-sm plan-task-icon-done" />;
  }
  if (status === "error") {
    return <Icon icon={CircleAlert} className="ui-icon-sm plan-task-icon-error" />;
  }
  return <Icon icon={Circle} className="ui-icon-sm plan-task-icon-pending" />;
}

function PlanPanelInner({
  tasks,
  meta = null,
  needsConfirm = false,
  busy = false,
  executing = false,
  ops: _ops = [],
  onExecute,
  onExecuteStep,
  onDismiss,
  onStop,
  onOpenFile: _onOpenFile,
}: Props) {
  const { t } = useI18n();
  // Checklist starts collapsed only for a completed header-only glance.
  // While awaiting confirm / resume / errors / execution it must be open —
  // otherwise Execute lives behind "View plan" and the plan is invisible.
  const [expanded, setExpanded] = useState(false);
  if (!tasks.length) return null;

  const doneCount = tasks.filter((task) => task.status === "done").length;
  const runningTask = tasks.find((task) => task.status === "running");
  const errorTask = tasks.find((task) => task.status === "error");
  const total = tasks.length;
  const partialProgress = doneCount > 0 && doneCount < total;
  const canResume = Boolean(onExecute && partialProgress && !executing && !busy);
  const showExecute = (needsConfirm || canResume) && onExecute;
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const isExecuting = executing || Boolean(runningTask) || (busy && !needsConfirm);
  const isAwaiting = needsConfirm && !isExecuting && !partialProgress;
  const isDone = doneCount === total && total > 0;

  let statusLabel = t("planStatusReady");
  if (errorTask) statusLabel = t("planStatusError");
  else if (isExecuting) {
    statusLabel = runningTask
      ? t("planStatusRunningTask").replace("{n}", String(doneCount + 1)).replace("{total}", String(total))
      : t("planStatusStarting");
  } else if (partialProgress) statusLabel = t("planStatusInterrupted");
  else if (isAwaiting) statusLabel = t("planStatusAwaiting");
  else if (isDone) statusLabel = t("planStatusDone");

  const hasHeaderCard = Boolean(meta?.title || meta?.summary);
  const checklistOpen =
    !hasHeaderCard ||
    expanded ||
    isExecuting ||
    isAwaiting ||
    canResume ||
    Boolean(errorTask);

  let statusChipClass = "plan-status-chip";
  if (isExecuting) statusChipClass += " is-building";
  else if (errorTask) statusChipClass += " is-error";
  else if (isDone) statusChipClass += " is-done";
  else if (isAwaiting) statusChipClass += " is-awaiting";

  return (
    <div
      className={`plan-panel${isExecuting ? " plan-panel-executing" : ""}${isAwaiting ? " plan-panel-awaiting" : ""}`}
    >
      {hasHeaderCard ? (
        <div className="plan-created-card">
          <p className="plan-created-eyebrow">{t("planCreatedEyebrow")}</p>
          <h4 className="plan-created-title">{meta?.title || t("planTitle")}</h4>
          {meta?.summary ? <p className="plan-created-summary">{meta.summary}</p> : null}
          <div className="plan-created-actions">
            <button
              type="button"
              className="plan-view-btn"
              aria-expanded={checklistOpen}
              onClick={() => setExpanded((v) => !v)}
            >
              {t("planViewPlan")}
              <Icon
                icon={ChevronDown}
                className={`ui-icon-sm plan-view-chevron${checklistOpen ? " is-open" : ""}`}
              />
            </button>
            <span className={statusChipClass}>
              {isExecuting ? <Icon icon={Loader2} className="ui-icon-sm agent-spin" /> : null}
              {isExecuting ? t("planStatusBuilding") : statusLabel}
            </span>
          </div>
        </div>
      ) : null}

      {checklistOpen ? (
        <div className="plan-build-card">
          <div className="plan-panel-head">
            <p className="plan-panel-title">
              <Icon icon={ListTodo} className="ui-icon-sm" />
              {hasHeaderCard ? t("planBuildTitle") : t("planTitle")}
            </p>
            <span className={`plan-panel-badge${isExecuting ? " live" : ""}${isAwaiting ? " await" : ""}`}>
              {isExecuting ? <Icon icon={Loader2} className="ui-icon-sm agent-spin" /> : null}
              {statusLabel}
            </span>
          </div>

          <div className="plan-progress">
            <div
              className="plan-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneCount}
              aria-valuetext={`${doneCount}/${total}`}
            >
              <div
                className={`plan-progress-fill${isExecuting ? " pulse" : ""}`}
                style={{ width: `${isExecuting && progress === 0 ? 8 : progress}%` }}
              />
            </div>
            <span className="plan-progress-label">
              {doneCount}/{total}
            </span>
          </div>

          {isExecuting && runningTask ? (
            <p className="plan-current" aria-live="polite">
              <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
              {runningTask.title}
            </p>
          ) : null}

          {isAwaiting ? (
            <p className="plan-await-hint">{t("planAwaitHint")}</p>
          ) : null}

          {partialProgress && !isExecuting && canResume ? (
            <p className="plan-await-hint">{t("planResumeHint")}</p>
          ) : null}

          <ol className="plan-tasks">
            {tasks.map((task, index) => (
              <li
                key={task.id}
                className={`plan-task plan-task-${task.status || "pending"}${
                  task.status === "running" ? " plan-task-active" : ""
                }`}
              >
                <span className="plan-task-index">{index + 1}</span>
                <TaskIcon status={task.status} />
                <span className="plan-task-title">{task.title}</span>
              </li>
            ))}
          </ol>

          {showExecute ? (
            <>
              <button type="button" className="btn plan-execute" disabled={busy} onClick={onExecute}>
                {busy ? (
                  <>
                    <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
                    {t("planExecuting")}
                  </>
                ) : (
                  <>
                    <Icon icon={Play} className="ui-icon-sm" />
                    {canResume ? t("planResume") : t("planExecute")}
                  </>
                )}
              </button>
              {onExecuteStep ? (
                <button
                  type="button"
                  className="btn plan-execute plan-execute-step"
                  disabled={busy}
                  onClick={onExecuteStep}
                >
                  <Icon icon={StepForward} className="ui-icon-sm" />
                  {partialProgress ? t("planNextStep") : t("planExecuteStep")}
                </button>
              ) : null}
              {needsConfirm && onDismiss ? (
                <button type="button" className="btn plan-dismiss" disabled={busy} onClick={onDismiss}>
                  {t("planDismiss")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {isExecuting && onStop ? (
        <div className="plan-footer">
          <span className="plan-footer-actions">
            <button type="button" className="plan-footer-btn plan-footer-stop" onClick={onStop}>
              <Icon icon={Square} className="ui-icon-sm" />
              {t("planStop")}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

// See AgentActivityPanel: historical plan panels receive stable props but
// re-render on every parent flush without memo.
export const PlanPanel = memo(PlanPanelInner);
