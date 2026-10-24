import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";
import { Glyph, type GlyphName } from "./glyph";

export type BadgeTone = "neutral" | "pro" | "free" | "solid" | "new";

/** Small 20px badge: plan gates (Pro, Free), "New" markers. */
export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span {...rest} className={cx("f-badge", tone !== "neutral" && `f-badge-${tone}`, className)}>
      {children}
    </span>
  );
}

export type TagTone = "neutral" | "ok" | "warn" | "danger" | "info" | "orange";

/** 24px pill for statuses and labels in tables and cards. */
export function Tag({
  tone = "neutral",
  icon,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: TagTone; icon?: GlyphName }) {
  return (
    <span {...rest} className={cx("f-tag", tone !== "neutral" && `f-tag-${tone}`, className)}>
      {icon ? <Glyph name={icon} size="xs" /> : null}
      {children}
    </span>
  );
}

export type ProjectState = "live" | "gen" | "draft" | "err";

/** Project state pill with its dot: live (green), gen (orange, blinking), draft, err (red). */
export function StatePill({ state, children, className }: { state: ProjectState; children: ReactNode; className?: string }) {
  return (
    <span className={cx("f-state", state !== "draft" && `f-state-${state}`, className)}>
      <i aria-hidden />
      {children}
    </span>
  );
}

/** Neutral 30px chip (feature lists, removable selections). */
export function Chip({
  icon,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { icon?: GlyphName }) {
  return (
    <span {...rest} className={cx("f-chip", className)}>
      {icon ? <Glyph name={icon} size="sm" style={{ color: "var(--f-accent-text)" }} /> : null}
      {children}
    </span>
  );
}

/** Filter chip with an optional colour dot and count (kind filters). */
export function FilterChip({
  pressed,
  dot,
  count,
  onClick,
  children,
  className,
}: {
  pressed: boolean;
  dot?: string;
  count?: number;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={cx("f-fchip", className)} aria-pressed={pressed} onClick={onClick}>
      {dot ? <i style={{ background: dot }} aria-hidden /> : null}
      {children}
      {count != null ? <span className="f-fchip-n">{count}</span> : null}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="f-kbd">{children}</kbd>;
}

/** Uppercase section label with the stepped orange mark. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("f-eyebrow", className)}>{children}</span>;
}
