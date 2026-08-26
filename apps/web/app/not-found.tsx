"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="app-error" role="alert">
      <div className="app-error-card">
        <h1 className="app-error-title">{t("notFoundTitle")}</h1>
        <p className="app-error-body">{t("notFoundBody")}</p>
        <div className="app-error-actions">
          <a className="landing-create" href="/dashboard">
            {t("errorBoundaryHome")}
          </a>
        </div>
      </div>
    </div>
  );
}
