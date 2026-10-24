"use client";

import { useState } from "react";

import { planDisplayName } from "@/components/RodiumWalletBadge";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { StairsMeter } from "@/components/ui/Meter";
import { useForgeStatus, type ForgeStatus } from "@/lib/forge-status";
import { dismissUsage, frodiUsage, isUsageDismissed, usageLevel } from "@/lib/frodi-usage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export function formatFrodi(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      maximumFractionDigits: 0,
    }).format(Math.max(0, value));
  } catch {
    return String(Math.round(value));
  }
}

/** "in 3 d" / "today" / "soon": when the FRODI allowance comes back. */
export function renewPhrase(
  resetsAt: string | null,
  t: (key: "bdFrodiToday" | "bdFrodiInDays" | "bdFrodiRenewSoon") => string,
): string {
  if (!resetsAt) return t("bdFrodiRenewSoon");
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return t("bdFrodiRenewSoon");
  if (ms <= 0) return t("bdFrodiToday");
  return t("bdFrodiInDays").replace("{n}", String(Math.max(1, Math.ceil(ms / 86_400_000))));
}

/** Free allotment is monthly; paid plans are weekly. */
function isMonthlyPlan(plan: string | null): boolean {
  return plan === "free";
}

/**
 * FRODI banner above the composer, shown once 80% of the allowance is used:
 * what is left, when it comes back, and the stepped meter. At 0 it turns red
 * and stays; before that it can be dismissed for the cycle.
 */
export function FrodiUsageBanner({
  onOpenSettings,
  status,
}: {
  onOpenSettings: () => void;
  /** Overrides the live account status (the dev states page). */
  status?: ForgeStatus | null;
}) {
  const { t, locale } = useI18n();
  const live = useForgeStatus();
  const forge = status !== undefined ? status : live;
  const usage = frodiUsage(forge);
  const level = usage ? usageLevel(usage.usedPct) : null;
  const [hiddenTick, setHiddenTick] = useState(0);
  const [open, setOpen] = useState(false);
  const hidden = hiddenTick >= 0 && level != null && isUsageDismissed(level, usage?.resetsAt ?? null);

  if (!usage || level == null || hidden) return null;

  const monthly = isMonthlyPlan(usage.plan);
  const out = level === 100 || usage.remaining <= 0;
  const when = renewPhrase(usage.resetsAt, t);
  const headline = out
    ? t(monthly ? "bdFrodiLeftMonth" : "bdFrodiLeftWeek")
    : t("bdFrodiLeft").replace("{n}", formatFrodi(usage.remaining, locale));
  const titleKey: MessageKey = monthly ? "frodiUsageTitleMonth" : "frodiUsageTitle";
  const cycleKey: MessageKey = monthly ? "frodiUsageMonth" : "frodiUsageWeek";
  const plan = planDisplayName(usage.plan);
  const ratio = usage.grant > 0 ? Math.max(0, usage.remaining) / usage.grant : 0;

  return (
    <div className={cx("f-bd-frodi", out ? "out" : "low")} role="status">
      <div className="top">
        <Glyph name={out ? "alert" : "zap"} size="sm" />
        <b>{headline}</b>
        <span className="x">{t("bdFrodiRenew").replace("{when}", when)}</span>
        {out ? null : (
          <IconButton
            icon="x"
            size="sm"
            plain
            label={t("frodiUsageDismiss")}
            onClick={() => {
              if (level === 80 || level === 95) dismissUsage(level, usage.resetsAt);
              setHiddenTick((n) => n + 1);
              setOpen(false);
            }}
          />
        )}
      </div>
      <StairsMeter
        size="sm"
        steps={24}
        value={ratio}
        label={t("bdFrodiMeter")}
        valueText={t("frodiUsageRemaining").replace("{n}", formatFrodi(usage.remaining, locale))}
      />
      <button type="button" className="f-bd-frodi-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t("bdFrodiDetails")}
        <Glyph name="chevron-down" size="xs" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open ? (
        <div className="f-bd-frodi-pop" aria-label={t(titleKey)}>
          <div className="row">
            <span>{t(titleKey)}</span>
            {plan ? <b>{plan}</b> : null}
          </div>
          <div className="row">
            <span>{t(cycleKey)}</span>
            <b>{usage.usedPct} %</b>
          </div>
          {out ? <p className="f-muted" style={{ margin: 0 }}>{t(monthly ? "frodiUsageLimitHintMonth" : "frodiUsageLimitHint")}</p> : null}
          <button
            type="button"
            className="f-bd-frodi-btn"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            {t("frodiUsageSettings")}
            <Glyph name="arrow-right" size="xs" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
