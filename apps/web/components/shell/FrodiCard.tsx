"use client";

import { nextPlanName, planDisplayName } from "@/components/RodiumWalletBadge";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { StairsMeter } from "@/components/ui/Meter";
import { useForgeStatus } from "@/lib/forge-status";
import { frodiUsage } from "@/lib/frodi-usage";
import { useI18n } from "@/lib/i18n/I18nProvider";

import { APP_ROUTES } from "./nav";

/** Days until `iso`, rounded up (0 when past or unknown). */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 86_400_000));
}

/** "6 240" in French (narrow no-break space), "6,240" in English. */
export function formatCount(n: number, locale: string): string {
  return Math.round(n).toLocaleString(locale === "en" ? "en-US" : "fr-FR");
}

/**
 * The sidebar plan card: plan chip, days to the reset, the stepped FRODI
 * meter and the upgrade button. FRODI only: the RODI balance lives on the
 * billing page. Hidden when the plan cannot be read (off Forge Cloud).
 */
export function FrodiCard({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const usage = frodiUsage(status);
  if (!usage) return null;

  const plan = usage.plan;
  const monthly = plan === "free";
  const days = daysUntil(usage.resetsAt);
  const remainingRatio = usage.grant ? usage.remaining / usage.grant : 0;
  const valueText = `${formatCount(usage.remaining, locale)} / ${formatCount(usage.grant, locale)}`;
  const next = nextPlanName(plan);
  const meterLabel = monthly ? t("uiFrodiLeftMonth") : t("uiFrodiLeftWeek");

  if (compact) {
    return <StairsMeter value={remainingRatio} label={meterLabel} valueText={valueText} steps={6} size="sm" />;
  }

  return (
    <div className="f-plan-mini">
      <div className="f-plan-mini-top">
        <span className="f-plan-chip">
          <Glyph name="crown" size="xs" />
          {planDisplayName(plan) ?? t("uiPlanUnknown")}
        </span>
        {days != null ? <small>{t("uiResetIn").replace("{n}", String(days))}</small> : null}
      </div>
      <StairsMeter value={remainingRatio} label={meterLabel} valueText={valueText} />
      <small>
        <b>{formatCount(usage.remaining, locale)}</b> / {formatCount(usage.grant, locale)} {meterLabel}
      </small>
      {next ? (
        <Button variant="ghost" size="sm" icon="zap" href={APP_ROUTES.billing}>
          {t("uiUpgradeTo").replace("{plan}", next)}
        </Button>
      ) : null}
    </div>
  );
}
