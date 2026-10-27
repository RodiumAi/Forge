"use client";

import { useAnalyticsConsent } from "@/lib/analytics/consent";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { RODIUM_LEGAL } from "@/lib/constants/rodium-links";
import { posthogEnabled } from "@/lib/posthog/client";

/**
 * Asks once whether analytics may run. Until the visitor answers, PostHog is
 * neither loaded nor given any storage.
 *
 * Hidden for automated browsers (end-to-end tests, crawlers): they never
 * consent, so no analytics runs for them either.
 */
export function ConsentBanner() {
  const { consent, grant, deny } = useAnalyticsConsent();
  const { t } = useI18n();

  if (!posthogEnabled) return null;
  // `undefined` is the server render and first paint; a string is a made choice.
  if (consent !== null) return null;
  if (typeof navigator !== "undefined" && navigator.webdriver) return null;

  return (
    <section
      role="region"
      aria-label={t("consentTitle")}
      data-testid="consent-banner"
      className="consent-banner"
    >
      <p className="consent-banner-title">{t("consentTitle")}</p>
      <p className="consent-banner-body muted">
        {t("consentBody")}{" "}
        <a
          href={RODIUM_LEGAL.cookies}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("consentLearnMore")}
        </a>
      </p>
      <div className="consent-banner-actions">
        <button
          type="button"
          className="btn"
          onClick={grant}
          data-testid="consent-accept"
        >
          {t("consentAccept")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={deny}
          data-testid="consent-decline"
        >
          {t("consentDecline")}
        </button>
      </div>
    </section>
  );
}
