"use client";

import { SettingsBlock, SettingsRow } from "@/components/SettingsShell";
import { useAnalyticsConsent } from "@/lib/analytics/consent";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { posthogEnabled } from "@/lib/posthog/client";

/** Settings block to review or change the analytics choice at any time. */
export function ConsentSettingsBlock() {
  const { consent, grant, deny } = useAnalyticsConsent();
  const { t } = useI18n();
  if (!posthogEnabled) return null;

  const status =
    consent === "granted"
      ? t("consentStatusGranted")
      : consent === "denied"
        ? t("consentStatusDenied")
        : t("consentStatusUnset");

  return (
    <SettingsBlock
      title={t("consentSettingsTitle")}
      subtitle={t("consentSettingsDescription")}
    >
      <SettingsRow
        title={consent === undefined ? "" : status}
        
      >
        {consent === "granted" ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={deny}
            data-testid="consent-turn-off"
          >
            {t("consentTurnOff")}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={grant}
            data-testid="consent-turn-on"
          >
            {t("consentTurnOn")}
          </button>
        )}
      </SettingsRow>
    </SettingsBlock>
  );
}
