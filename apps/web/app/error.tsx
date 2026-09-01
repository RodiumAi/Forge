"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Route-level error boundary.
 *
 * Next.js renders this instead of unmounting the whole tree when a client
 * component throws. Without it, a single exception in the builder produced a
 * blank white page with no way to recover.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("route error:", error);
  }, [error]);

  return (
    <div className="app-error" role="alert">
      <div className="app-error-card">
        <h1 className="app-error-title">{t("errorBoundaryTitle")}</h1>
        <p className="app-error-body">{t("errorBoundaryBody")}</p>
        {error.message ? <pre className="app-error-detail">{error.message}</pre> : null}
        <div className="app-error-actions">
          <button type="button" className="landing-create" onClick={() => reset()}>
            {t("errorBoundaryRetry")}
          </button>
          <a className="app-error-link" href="/dashboard">
            {t("errorBoundaryHome")}
          </a>
        </div>
      </div>
    </div>
  );
}
