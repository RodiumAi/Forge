"use client";

/**
 * The screen shown while a RodiumAi sign-in completes (OIDC callback, the
 * dashboard handoff, the sign-in popup, autostart) and when it fails.
 *
 * It sits in the auth frame without the showcase: it is on screen for a
 * second or two, so a calm card with the three steps reads better than a
 * gallery that would barely start loading.
 */

import { AuthAlert, AuthFrame } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  error?: string | null;
  onRetry?: () => void;
};

export function AuthCallbackScreen({ error, onRetry }: Props) {
  const { t } = useI18n();

  const steps = [
    { key: "loginRodiumStepAuth" as const, state: "done" },
    { key: "loginRodiumStepSync" as const, state: "active" },
    { key: "loginRodiumStepOpen" as const, state: "todo" },
  ];

  return (
    <AuthFrame showcase={false}>
      <div className="f-auth-card f-auth-callback" aria-live="polite">
        {error ? (
          <>
            <div className="f-auth-head has-tile">
              <span className="f-auth-tile is-danger" aria-hidden>
                <Glyph name="alert" size="md" />
              </span>
              <h1>{t("loginRodiumErrorTitle")}</h1>
            </div>
            <AuthAlert tone="err">{error}</AuthAlert>
            {onRetry ? (
              <Button block size="lg" icon="refresh" onClick={onRetry}>
                {t("loginTitle")}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <div className="f-auth-head has-tile">
              <span className="f-auth-orbit" aria-hidden>
                <span className="ring" />
                <img src="/brand/forge/forge-app-icon-orange.svg" alt="" width={44} height={44} />
              </span>
              <h1>{t("loginRodiumCompleting")}</h1>
              <p>{t("loginRodiumCompletingSub")}</p>
            </div>
            <ol className="f-auth-steps">
              {steps.map((step) => (
                <li key={step.key} className={cx(`is-${step.state}`)}>
                  <span className="dot" aria-hidden>
                    {step.state === "done" ? <Glyph name="check" size="sm" /> : null}
                  </span>
                  <span>{t(step.key)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
