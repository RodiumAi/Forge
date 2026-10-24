"use client";

import { memo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
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
  /** Plan title/summary from the planner. */
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

/**
 * The "Plan" card: numbered steps (done, running, waiting), the done count on
 * the right, and the controls to run, step through, dismiss or stop it.
 */
function PlanPanelInner({
  tasks,
  meta = null,
  needsConfirm = false,
  busy = false,
  executing = false,
  onExecute,
  onExecuteStep,
  onDismiss,
  onStop,
}: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  if (!tasks.length) return null;

  const doneCount = tasks.filter((task) => task.status === "done").length;
  const runningTask = tasks.find((task) => task.status === "running");
  const errorTask = tasks.find((task) => task.status === "error");
  const total = tasks.length;
  const partialProgress = doneCount > 0 && doneCount < total;
  const canResume = Boolean(onExecute && partialProgress && !executing && !busy);
  const showExecute = (needsConfirm || canResume) && onExecute;
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

  // While the plan runs the list always shows; otherwise it folds on demand.
  const listOpen = expanded || isExecuting;

  return (
    <section
      className={cx("f-bd-card", "f-bd-plan", errorTask && "f-bd-card-warn")}
      aria-busy={isExecuting || undefined}
    >
      <button type="button" className="f-bd-card-head" aria-expanded={listOpen} onClick={() => setExpanded((v) => !v)}>
        <Glyph name="list" size="sm" />
        {meta?.title || t("bdPlan")}
        <span className="r">
          {isExecuting ? <Glyph name="refresh" size="sm" className="f-spin" /> : null}
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
            aria-valuetext={`${doneCount}/${total}`}
            aria-label={statusLabel}
          >
            {doneCount} / {total}
          </span>
          <Glyph name="chevron-down" size="sm" style={{ transform: listOpen ? "rotate(180deg)" : undefined }} />
        </span>
      </button>
      <div className="f-bd-card-body">
        {meta?.summary ? (
          <div className="f-bd-plan-meta">
            <p>{meta.summary}</p>
          </div>
        ) : null}
        {isAwaiting ? <p className="f-bd-plan-hint">{t("planAwaitHint")}</p> : null}
        {partialProgress && !isExecuting && canResume ? <p className="f-bd-plan-hint">{t("planResumeHint")}</p> : null}
        {!listOpen ? <p className="f-bd-plan-hint">{statusLabel}</p> : null}
        {listOpen ? (
          <ol className="f-bd-tasks">
            {tasks.map((task, index) => {
              const st = task.status || "pending";
              return (
                <li
                  key={task.id}
                  className={cx("f-bd-task", st)}
                  aria-current={st === "running" ? "step" : undefined}
                >
                  <span className="ix" aria-hidden>
                    {st === "done" ? <Glyph name="check" size="xs" /> : st === "error" ? "!" : index + 1}
                  </span>
                  <span className="tt">{task.title}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      {showExecute || (isExecuting && onStop) ? (
        <div className="f-bd-card-actions">
          {showExecute ? (
            <Button size="sm" icon="play" loading={busy} onClick={onExecute}>
              {busy ? t("planExecuting") : canResume ? t("planResume") : t("planExecute")}
            </Button>
          ) : null}
          {showExecute && onExecuteStep ? (
            <Button size="sm" variant="ghost" icon="arrow-right" disabled={busy} onClick={onExecuteStep}>
              {partialProgress ? t("planNextStep") : t("planExecuteStep")}
            </Button>
          ) : null}
          {showExecute && needsConfirm && onDismiss ? (
            <Button size="sm" variant="subtle" disabled={busy} onClick={onDismiss}>
              {t("planDismiss")}
            </Button>
          ) : null}
          {isExecuting && onStop ? (
            <Button size="sm" variant="ghost" icon="square" onClick={onStop}>
              {t("planStop")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// See AgentActivityPanel: historical plan panels receive stable props but
// re-render on every parent flush without memo.
export const PlanPanel = memo(PlanPanelInner);
