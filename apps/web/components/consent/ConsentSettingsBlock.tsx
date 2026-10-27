"use client";

import { SwitchRow } from "@/components/ui/Switch";
import { useAnalyticsConsent } from "@/lib/analytics/consent";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { posthogEnabled } from "@/lib/posthog/client";

/** Settings switch to review or change the analytics choice at any time. */
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
    <SwitchRow
      title={t("consentSettingsTitle")}
      description={consent === undefined ? t("consentSettingsDescription") : status}
      checked={consent === "granted"}
      onChange={(next) => (next ? grant() : deny())}
    />
  );
}
