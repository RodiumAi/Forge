"use client";

import type { CSSProperties } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import type { ProjectKindId } from "@/lib/kinds";

import { cx } from "./cx";
import { Glyph } from "./glyph";

/** Pill with the kind's colour dot and label ("Site web", "Slides"...). */
export function KindBadge({ kind, className }: { kind: ProjectKindId; className?: string }) {
  const { t } = useI18n();
  const k = kindStyle(kind);
  return (
    <span className={cx("f-kind-badge", className)} style={{ "--f-k": k.color } as CSSProperties}>
      <i aria-hidden />
      {t(k.labelKey)}
    </span>
  );
}

/** Square tile with the kind's glyph in white on its colour (project cards, palette rows). */
export function KindIcon({
  kind,
  size = "md",
  className,
  label,
}: {
  kind: ProjectKindId;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Accessible name; decorative when omitted. */
  label?: string;
}) {
  const k = kindStyle(kind);
  return (
    <span
      className={cx("f-kind-icon", size !== "md" && `f-kind-icon-${size}`, className)}
      style={{ "--f-k": k.color } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Glyph name={k.glyph} size="sm" />
    </span>
  );
}
