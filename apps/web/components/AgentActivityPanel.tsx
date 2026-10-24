"use client";

import { memo, useEffect, useRef, useState } from "react";

import { Tag } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AgentStep = {
  id: string;
  label: string;
  status: "running" | "done" | "error" | string;
  /** Client-side wall clock, filled when the step first appears. */
  startedAt?: number;
  endedAt?: number;
};

export type FileOp = { op: string; path: string; taskId?: string };

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

/** Files listed before the "+N more files" line. */
const MAX_OPS = 8;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 100)) / 10} s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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
        timings.current.set(step.id, { start: step.startedAt ?? Date.now(), end: step.endedAt });
        changed = true;
      } else if (step.status !== "running" && entry.end === undefined) {
        entry.end = step.endedAt ?? Date.now();
        changed = true;
      }
    }
    if (changed) force((n) => n + 1);
  }, [steps]);

  return timings.current;
}

/** Re-render once a second while the run is live, for the elapsed clock. */
function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
}

function normaliseOps(raw: FileOp[] | string[] | undefined): FileOp[] {
  if (!raw?.length) return [];
  return (raw as Array<FileOp | string>).map((item) =>
    typeof item === "string" ? { op: "write", path: item } : item,
  );
}

/**
 * The "Activité" card of a Forge turn: the steps with their durations, the
 * files written one by one (the latest one marked "writing" while the run
 * streams), the effort tag, the reasoning on demand and any warnings.
 */
function AgentActivityPanelInner({
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
  // Historic turns start collapsed: everything used to stay expanded forever,
  // which made the thread unreadable after a few turns.
  const [open, setOpen] = useState(live);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const thinkingRef = useRef<HTMLPreElement>(null);
  const timings = useStepTimings(steps);
  const ops = normaliseOps(fileOps);
  useTicker(streaming);

  // Follow the reasoning as it streams instead of letting it scroll out of view.
  useEffect(() => {
    if (!streaming || !thinkingOpen) return;
    const el = thinkingRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking, streaming, thinkingOpen]);

  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);

  if (!steps.length && !thinking && !warnings.length && !effortLabel && !streaming && !ops.length) {
    return null;
  }

  const doneSteps = steps.filter((s) => s.status === "done").length;
  const errorSteps = steps.filter((s) => s.status === "error").length;
  let firstStart = Infinity;
  let lastEnd = 0;
  let totalMs = 0;
  for (const s of steps) {
    const entry = timings.get(s.id);
    if (!entry) continue;
    firstStart = Math.min(firstStart, entry.start);
    if (entry.end) {
      lastEnd = Math.max(lastEnd, entry.end);
      totalMs += entry.end - entry.start;
    }
  }
  const elapsedMs = Number.isFinite(firstStart)
    ? (streaming ? Date.now() : lastEnd || firstStart) - firstStart
    : 0;

  const fileCount = new Set(ops.map((op) => op.path)).size;
  const summary = errorSteps
    ? t("agentStepsSummaryError").replace("{n}", String(errorSteps))
    : fileCount
      ? fileCount === 1
        ? t("bdDoneFile")
        : t("bdDoneFiles").replace("{n}", String(fileCount))
      : steps.length && totalMs > 0
        ? t("agentStepsSummary").replace("{n}", String(doneSteps)).replace("{d}", formatDuration(totalMs))
        : steps.length
          ? `${doneSteps} / ${steps.length}`
          : "";

  const shownOps = ops.slice(-MAX_OPS);
  const hiddenOps = ops.length - shownOps.length;
  const opLabel = (op: string) =>
    op === "delete" ? t("bdOpDelete") : op === "edit" ? t("bdOpEdit") : t("bdOpWrite");

  return (
    <section className={cx("f-bd-card", "f-bd-activity", errorSteps > 0 && "f-bd-card-warn")}>
      <button type="button" className="f-bd-card-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Glyph name="zap" size="sm" />
        {t("bdActivity")}
        <span className="r">
          {!open && effortLabel ? <span className="f-bd-effort-mini">{effortLabel}</span> : null}
          {open && (streaming || elapsedMs > 0) ? (
            <>
              <Glyph name="clock" size="sm" />
              <span aria-label={t("bdActivityElapsed")}>{formatClock(elapsedMs)}</span>
            </>
          ) : (
            summary
          )}
          <Glyph name="chevron-down" size="sm" style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </span>
      </button>
      {open ? (
        <div className="f-bd-card-body">
          {effortLabel ? (
            <Tag className="f-bd-effort" icon="cpu">
              {effortLabel}
            </Tag>
          ) : null}

          {steps.length > 0 ? (
            <ol className="f-bd-steps">
              {steps.map((step) => {
                const entry = timings.get(step.id);
                const elapsed = entry?.end !== undefined ? formatDuration(entry.end - entry.start) : "";
                const cls =
                  step.status === "done"
                    ? "done"
                    : step.status === "error"
                      ? "error"
                      : step.status === "running"
                        ? "running"
                        : "wait";
                return (
                  <li key={step.id} className={cx("f-bd-step", cls)}>
                    <span className="st" aria-hidden>
                      {cls === "done" ? <Glyph name="check" size="xs" /> : cls === "error" ? "!" : null}
                    </span>
                    <span className="lb">{step.label}</span>
                    <span className="tm">{elapsed}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {shownOps.length > 0 ? (
            <div className="f-bd-ops">
              {hiddenOps > 0 ? (
                <span className="f-bd-more-ops">{t("bdFilesMore").replace("{n}", String(hiddenOps))}</span>
              ) : null}
              {shownOps.map((op, index) => {
                const deleted = op.op === "delete";
                const writing = streaming && index === shownOps.length - 1 && !deleted;
                const inner = (
                  <>
                    <Glyph name={deleted ? "trash" : "file"} size="sm" />
                    <span className="p">{op.path}</span>
                    {writing ? <span className="w">{t("bdOpWriting")}</span> : <span className="n">{opLabel(op.op)}</span>}
                  </>
                );
                const key = `${op.path}-${index}`;
                return onOpenFile && !deleted ? (
                  <button key={key} type="button" className="f-bd-op" onClick={() => onOpenFile(op.path)} title={t("fileOpOpen")}>
                    {inner}
                  </button>
                ) : (
                  <div key={key} className={cx("f-bd-op", deleted && "is-delete")}>
                    {inner}
                  </div>
                );
              })}
            </div>
          ) : null}

          {thinking ? (
            <div className="f-bd-sub">
              <button
                type="button"
                className="f-bd-sub-toggle"
                onClick={() => setThinkingOpen((v) => !v)}
                aria-expanded={thinkingOpen}
              >
                <Glyph name="chevron-right" size="xs" />
                {t("agentThinkingLabel")}
              </button>
              {thinkingOpen ? (
                <pre className="f-bd-thinking" ref={thinkingRef}>
                  {thinking}
                </pre>
              ) : null}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="f-bd-warnings">
              {warnings.map((w, i) => (
                <li key={`${w.code || "warn"}-${i}`}>
                  <Glyph name="alert" size="sm" />
                  <span>
                    {w.path ? <code>{w.path}</code> : null} {w.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// Every parent flush during a run rebuilds this component's props with new
// array identities. Historical turns receive identical props on every flush
// and memo() keeps them out of the render loop. The live panel still
// re-renders because its steps/ops arrays grow with each event.
export const AgentActivityPanel = memo(AgentActivityPanelInner);
