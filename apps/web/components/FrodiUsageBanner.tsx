"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { useForgeStatus } from "@/lib/forge-status";
import {
  dismissUsage,
  frodiUsage,
  isUsageDismissed,
  usageLevel,
} from "@/lib/frodi-usage";
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatAmount(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

function resetPhrase(
  resetsAt: string | null,
  t: (key: "frodiUsageResetsToday" | "frodiUsageResetsOne" | "frodiUsageResetsDays") => string,
): string {
  if (!resetsAt) return "";
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return t("frodiUsageResetsToday");
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return t("frodiUsageResetsOne");
  return t("frodiUsageResetsDays").replace("{n}", String(days));
}

export function FrodiUsageBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t, locale } = useI18n();
  const forge = useForgeStatus();
  const usage = frodiUsage(forge);
  const level = usage ? usageLevel(usage.usedPct) : null;
  const [hiddenTick, setHiddenTick] = useState(0);
  const [open, setOpen] = useState(false);
  const hidden =
    hiddenTick >= 0 && level != null && isUsageDismissed(level, usage?.resetsAt ?? null);

  if (!usage || level == null || hidden) return null;

  const atLimit = level === 100;
  const reset = resetPhrase(usage.resetsAt, t);
  const headline = atLimit
    ? t("frodiUsageLimit")
    : t("frodiUsageUsed").replace("{pct}", String(usage.usedPct));
  const plan = planDisplayName(usage.plan);

  return (
    <div className={`frodi-usage${atLimit ? " is-limit" : ""}`}>
      <p className="frodi-usage-line">
        <span className="frodi-usage-copy">
          {headline}
          {reset ? <span className="frodi-usage-reset"> · {reset}</span> : null}
        </span>
        <span className="frodi-usage-sep" aria-hidden>
          ·
        </span>
        <button type="button" className="frodi-usage-link" onClick={() => setOpen((v) => !v)}>
          {t("frodiUsageView")}
        </button>
      </p>
      {atLimit ? null : (
        <button
          type="button"
          className="frodi-usage-dismiss"
          aria-label={t("frodiUsageDismiss")}
          onClick={() => {
            if (level === 80 || level === 95) dismissUsage(level, usage.resetsAt);
            setHiddenTick((n) => n + 1);
            setOpen(false);
          }}
        >
          <Icon icon={X} className="ui-icon-sm" />
        </button>
      )}
      {open ? (
        <div className="frodi-usage-pop" role="dialog" aria-label={t("frodiUsageTitle")}>
          <header>
            <strong>{t("frodiUsageTitle")}</strong>
            {plan ? <span>{plan}</span> : null}
          </header>
          <div className="frodi-usage-row">
            <span>{t("frodiUsageWeek")}</span>
            <span>{usage.usedPct}%</span>
          </div>
          <div className="frodi-usage-track" aria-hidden>
            <span style={{ width: `${usage.usedPct}%` }} />
          </div>
          <p className="frodi-usage-meta">
            {reset ? <span>{reset}</span> : null}
            <span>{t("frodiUsageRemaining").replace("{n}", formatAmount(usage.remaining, locale))}</span>
          </p>
          {atLimit ? <p className="frodi-usage-hint">{t("frodiUsageLimitHint")}</p> : null}
          <button
            type="button"
            className="frodi-usage-settings"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            {t("frodiUsageSettings")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
