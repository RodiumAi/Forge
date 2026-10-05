"use client";

/**
 * The in-builder subscription surface.
 *
 * A read-only summary of the account's Forge plan and credit reservoirs, with a
 * single deep-link out to the RodiumAi user app (`/dashboard/forge`) where plans
 * are actually changed. Subscriptions do not live inside the builder, so this
 * panel never mutates state — it reflects `GET /auth/forge/status` and hands off.
 *
 * Off Forge Cloud (open-source clones, or accounts with no RodiumAi link) the
 * status comes back empty; the panel then explains that plans are managed on
 * RodiumAi rather than showing an empty plan card.
 */

import { ExternalLink, Sparkles } from "lucide-react";
import { useEffect } from "react";

import { Icon } from "@/components/ui/icon";
import { rodiumUpgradeUrl } from "@/lib/constants/rodium-links";
import { refreshForgeStatus, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatCredits(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function SubscriptionPanel() {
  const { t, locale } = useI18n();
  const forge = useForgeStatus();

  // Refresh once when the panel opens so the figures are current after a
  // generation spent credits elsewhere in the session.
  useEffect(() => {
    void refreshForgeStatus();
  }, []);

  const plan = forge?.entitlements?.plan_slug ?? forge?.plan ?? null;
  const status = forge?.entitlements?.status ?? null;
  const hasFrodi = forge?.frodi != null;
  const hasRodi = forge?.rodi != null;

  return (
    <div className="options-card options-stack subscription-panel">
      <div className="subscription-plan-head">
        <span className="subscription-plan-badge">
          <Icon icon={Sparkles} className="ui-icon-sm" />
          {plan ? plan.toUpperCase() : t("subscriptionPlanUnknown")}
        </span>
        {status ? <span className="subscription-plan-status">{status}</span> : null}
      </div>

      <div className="options-stat-row">
        <span>{t("subscriptionFrodi")}</span>
        <strong className={hasFrodi ? "ok" : "muted"}>
          {formatCredits(forge?.frodi ?? null, locale)}
        </strong>
      </div>
      <div className="options-stat-row">
        <span>{t("subscriptionRodi")}</span>
        <strong className={hasRodi ? "" : "muted"}>
          {formatCredits(forge?.rodi ?? null, locale)}
        </strong>
      </div>

      <p className="options-help">
        {hasFrodi ? t("subscriptionResetHint") : t("subscriptionOffCloudHint")}
      </p>

      <div className="options-actions">
        <a className="btn" href={rodiumUpgradeUrl()}>
          <Icon icon={ExternalLink} className="ui-icon-sm" />
          {t("subscriptionManage")}
        </a>
      </div>
    </div>
  );
}
