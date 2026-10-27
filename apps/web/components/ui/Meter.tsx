import type { ReactNode } from "react";

import { cx } from "./cx";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Level of a "remaining" ratio: under 20% warn, at 0 danger. */
export function meterLevel(remainingRatio: number): "ok" | "warn" | "danger" {
  const r = clamp01(remainingRatio);
  if (r <= 0) return "danger";
  if (r < 0.2) return "warn";
  return "ok";
}

type MeterProps = {
  /** 0 to 1. */
  value: number;
  /** Accessible name, e.g. "FRODI left this week". */
  label: string;
  /** Human value read by screen readers, e.g. "6 240 of 10 000". */
  valueText?: string;
  /** Text under the bar: left and right. */
  legend?: [ReactNode, ReactNode];
  size?: "md" | "lg";
  /** Colours the bar: warn (amber) and danger (red). Defaults to orange. */
  level?: "ok" | "warn" | "danger";
  className?: string;
};

/** Thin progress bar (seat usage, member FRODI, exports). role="meter". */
export function Meter({ value, label, valueText, legend, size = "md", level = "ok", className }: MeterProps) {
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div className={cx("f-meter", size === "lg" && "f-meter-lg", className)} data-level={level}>
      <div
        className="f-meter-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={valueText}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      {legend ? (
        <div className="f-meter-legend">
          <span>{legend[0]}</span>
          <span>{legend[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

type StairsMeterProps = {
  /** Remaining ratio, 0 to 1: lit steps from the left. */
  value: number;
  label: string;
  valueText?: string;
  /** Number of steps (12 by default, 18 in the billing card). */
  steps?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * The FRODI gauge drawn as the steps of the Forge icon: bars rising from 22%
 * to 100% of the height, the first ones lit in flat orange.
 */
export function StairsMeter({ value, label, valueText, steps = 12, size = "md", className }: StairsMeterProps) {
  const ratio = clamp01(value);
  const on = Math.round(ratio * steps);
  return (
    <div
      className={cx("f-stairs", size !== "md" && `f-stairs-${size}`, className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={valueText}
    >
      {Array.from({ length: steps }, (_, i) => (
        <i
          key={i}
          className={i < on ? "on" : undefined}
          style={{ height: `${(22 + (78 * i) / Math.max(1, steps - 1)).toFixed(1)}%` }}
        />
      ))}
    </div>
  );
}
