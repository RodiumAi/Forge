"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AlertCircle, Loader2 } from "lucide-react";

type Props = {
  error?: string | null;
  onRetry?: () => void;
};

export function AuthCallbackScreen({ error, onRetry }: Props) {
  const { t } = useI18n();

  return (
    <div className="auth-callback-page" aria-live="polite">
      <div className="auth-callback-glow auth-callback-glow--a" aria-hidden="true" />
      <div className="auth-callback-glow auth-callback-glow--b" aria-hidden="true" />

      <div className="auth-callback-card">
        <div className="auth-callback-brand">
          <BrandLogo alt={t("brandAlt")} width={200} height={58} priority />
        </div>

        {error ? (
          <div className="auth-callback-error">
            <span className="auth-callback-error-icon" aria-hidden="true">
              <Icon icon={AlertCircle} className="ui-icon-lg" />
            </span>
            <h1 className="auth-callback-title">{t("loginRodiumErrorTitle")}</h1>
            <p className="auth-callback-error-text">{error}</p>
            {onRetry ? (
              <button className="btn auth-callback-retry" type="button" onClick={onRetry}>
                {t("loginTitle")}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="auth-callback-loader" aria-hidden="true">
              <span className="auth-callback-loader-ring" />
              <span className="auth-callback-loader-core">
                <Icon icon={Loader2} className="ui-icon-md agent-spin" />
              </span>
            </div>

            <h1 className="auth-callback-title">{t("loginRodiumCompleting")}</h1>
            <p className="auth-callback-sub">{t("loginRodiumCompletingSub")}</p>

            <ol className="auth-callback-steps">
              <li className="auth-callback-step is-done">
                <span className="auth-callback-step-dot" />
                <span>{t("loginRodiumStepAuth")}</span>
              </li>
              <li className="auth-callback-step is-active">
                <span className="auth-callback-step-dot" />
                <span>{t("loginRodiumStepSync")}</span>
              </li>
              <li className="auth-callback-step">
                <span className="auth-callback-step-dot" />
                <span>{t("loginRodiumStepOpen")}</span>
              </li>
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
