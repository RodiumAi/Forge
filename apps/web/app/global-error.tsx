"use client";

import { useEffect } from "react";

import { THEME_INIT_SCRIPT } from "@/lib/theme/init-script";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself
 * (providers, fonts, theme). It must render its own <html>/<body> because the
 * layout that would normally provide them is exactly what failed — and it
 * cannot use the i18n provider for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error:", error);
  }, [error]);

  return (
    // No data-theme attribute: the script below sets it, and if even that fails
    // the @media (prefers-color-scheme) block in globals.css still resolves a
    // readable theme. Hardcoding "dark" here showed light-mode users a dark
    // crash screen.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="app-error" role="alert">
          <div className="app-error-card">
            <h1 className="app-error-title">Une erreur est survenue</h1>
            <p className="app-error-body">
              L&apos;application n&apos;a pas pu démarrer. Réessayez, ou rechargez la page.
            </p>
            {error.message ? <pre className="app-error-detail">{error.message}</pre> : null}
            <div className="app-error-actions">
              <button type="button" className="landing-create" onClick={() => reset()}>
                Réessayer
              </button>
              {/* global-error replaces the root layout, so the Next router is
                  not mounted here: a plain anchor (full reload) is required. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="app-error-link" href="/">
                Accueil
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
