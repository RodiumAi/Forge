"use client";

import { Check, Circle, CircleAlert, Loader2, ListTodo, Play } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type PlanTask = {
  id: string;
  title: string;
  status?: "pending" | "running" | "done" | "error" | string;
};

type Props = {
  tasks: PlanTask[];
  needsConfirm?: boolean;
  busy?: boolean;
  executing?: boolean;
  onExecute?: () => void;
  onDismiss?: () => void;
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

export function PlanPanel({
  tasks,
  needsConfirm = false,
  busy = false,
  executing = false,
  onExecute,
  onDismiss,
}: Props) {
  const { t } = useI18n();
  if (!tasks.length) return null;

  const doneCount = tasks.filter((task) => task.status === "done").length;
  const runningTask = tasks.find((task) => task.status === "running");
  const errorTask = tasks.find((task) => task.status === "error");
  const total = tasks.length;
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const isExecuting = executing || Boolean(runningTask) || (busy && !needsConfirm);
  const isAwaiting = needsConfirm && !isExecuting;

  let statusLabel = t("planStatusReady");
  if (errorTask) statusLabel = t("planStatusError");
  else if (isExecuting) {
    statusLabel = runningTask
      ? t("planStatusRunningTask").replace("{n}", String(doneCount + 1)).replace("{total}", String(total))
      : t("planStatusStarting");
  } else if (isAwaiting) statusLabel = t("planStatusAwaiting");
  else if (doneCount === total && total > 0) statusLabel = t("planStatusDone");

  return (
    <div
      className={`plan-panel${isExecuting ? " plan-panel-executing" : ""}${isAwaiting ? " plan-panel-awaiting" : ""}`}
    >
      <div className="plan-panel-head">
        <p className="plan-panel-title">
          <Icon icon={ListTodo} className="ui-icon-sm" />
          {t("planTitle")}
        </p>
        <span className={`plan-panel-badge${isExecuting ? " live" : ""}${isAwaiting ? " await" : ""}`}>
          {isExecuting ? <Icon icon={Loader2} className="ui-icon-sm agent-spin" /> : null}
          {statusLabel}
        </span>
      </div>

      <div className="plan-progress" aria-hidden={!isExecuting && !doneCount}>
        <div className="plan-progress-track">
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

      {needsConfirm && onExecute ? (
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
                {t("planExecute")}
              </>
            )}
          </button>
          {onDismiss ? (
            <button type="button" className="btn plan-dismiss" disabled={busy} onClick={onDismiss}>
              {t("planDismiss")}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
