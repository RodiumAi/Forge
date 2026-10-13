"use client";

import { useAnalyticsConsent } from "@/lib/analytics/consent";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { posthogEnabled } from "@/lib/posthog/client";

/** Footer entry point: forgets the choice so the banner asks again. */
export function ConsentSettingsButton() {
  const { reset } = useAnalyticsConsent();
  const { t } = useI18n();
  if (!posthogEnabled) return null;
  return (
    <button
      type="button"
      onClick={reset}
      className="lp-footer-link-button"
      data-testid="consent-manage"
    >
      {t("consentManage")}
    </button>
  );
}
