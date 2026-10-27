"use client";

/**
 * The frame every auth screen sits in.
 *
 * Desktop: the form on the left (logo, home link, FR/EN and theme on top, the
 * legal links at the bottom) and the living showcase of real Forge templates
 * on the right. Phones and narrow windows: the form alone, one column, with
 * the stepped motif faintly behind it.
 *
 * `AuthCard` keeps its original props (title, subtitle, error, notice,
 * children, footer) so every auth page shares one layout, and adds an optional
 * status tile (`icon` + `tone`) for the "check your inbox", "confirmed" and
 * "link expired" screens.
 */

import Link from "next/link";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { STEPS_PATH } from "@/components/landing/LandingHero";
import { PrefControls, PublicLogo } from "@/components/landing/PublicChrome";
import { cx } from "@/components/ui/cx";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { RODIUM_LEGAL } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AuthTone = "accent" | "ok" | "danger" | "neutral";

/** Split layout: form column + showcase. `showcase={false}` centres the form alone. */
export function AuthFrame({
  children,
  showcase = true,
  legal = false,
}: {
  children: ReactNode;
  showcase?: boolean;
  /** Show "By continuing, you agree to..." under the card (sign in, sign up). */
  legal?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cx("f-scope f-auth", !showcase && "is-solo")}>
      <div className="f-auth-col">
        <div className="f-auth-col-bg" aria-hidden>
          <svg className="steps" viewBox="0 0 1000 1000">
            <path fill="currentColor" d={STEPS_PATH} />
          </svg>
        </div>
        <header className="f-auth-bar">
          <PublicLogo />
          <div className="f-auth-bar-right">
            <Link className="f-auth-home" href="/" aria-label={t("lndAuthBack")}>
              <Glyph name="arrow-left" size="sm" />
              <span>{t("lndAuthHome")}</span>
            </Link>
            <PrefControls />
          </div>
        </header>
        <main className="f-auth-main" id="main">
          <div className="f-auth-main-inner">
            {children}
            {legal ? <LegalLine /> : null}
          </div>
        </main>
        <footer className="f-auth-legal">
          <nav aria-label={t("lndFLegal")}>
            <a href={RODIUM_LEGAL.terms} target="_blank" rel="noopener noreferrer">
              {t("lndFTerms")}
            </a>
            <a href={RODIUM_LEGAL.privacy} target="_blank" rel="noopener noreferrer">
              {t("lndFPrivacy")}
            </a>
            <a href={RODIUM_LEGAL.help} target="_blank" rel="noopener noreferrer">
              {t("lndFHelp")}
            </a>
          </nav>
        </footer>
      </div>
      {showcase ? <AuthShowcase /> : null}
    </div>
  );
}

function LegalLine() {
  const { t } = useI18n();
  const [before, rest = ""] = t("lndAuthLegal").split("{terms}");
  const [middle, after = ""] = rest.split("{privacy}");
  return (
    <p className="f-auth-legal-line">
      {before}
      <a href={RODIUM_LEGAL.terms} target="_blank" rel="noopener noreferrer">
        {t("lndAuthTerms")}
      </a>
      {middle}
      <a href={RODIUM_LEGAL.privacy} target="_blank" rel="noopener noreferrer">
        {t("lndAuthPrivacy")}
      </a>
      {after}
    </p>
  );
}

/** Error, warning or confirmation banner inside a card. */
export function AuthAlert({ tone, children }: { tone: "err" | "ok" | "warn"; children: ReactNode }) {
  return (
    <div className={cx("f-auth-alert", tone)} role={tone === "ok" ? "status" : "alert"}>
      <Glyph name={tone === "ok" ? "check" : "alert"} size="sm" />
      <span>{children}</span>
    </div>
  );
}

export function AuthCard({
  title,
  subtitle,
  error,
  notice,
  children,
  footer,
  icon,
  tone = "accent",
  showcase = true,
  legal = false,
}: {
  title: string;
  subtitle?: ReactNode;
  error?: string | null;
  notice?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
  /** Status tile above the title. */
  icon?: GlyphName | "spinner";
  tone?: AuthTone;
  showcase?: boolean;
  legal?: boolean;
}) {
  return (
    <AuthFrame showcase={showcase} legal={legal}>
      <div className="f-auth-card">
        <div className={cx("f-auth-head", icon && "has-tile")}>
          {icon ? (
            <span className={cx("f-auth-tile", `is-${tone}`)} aria-hidden>
              {icon === "spinner" ? <span className="f-auth-spinner" /> : <Glyph name={icon} size="md" />}
            </span>
          ) : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        {error ? <AuthAlert tone="err">{error}</AuthAlert> : null}
        {notice ? <AuthAlert tone="ok">{notice}</AuthAlert> : null}

        {children}

        {footer ? <div className="f-auth-foot">{footer}</div> : null}
      </div>
    </AuthFrame>
  );
}

/** Horizontal rule with a word in the middle, between social and credentials. */
export function AuthDivider() {
  const { t } = useI18n();
  return (
    <div className="f-auth-divider" aria-hidden="true">
      <span>{t("authOr")}</span>
    </div>
  );
}

type ControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Label + one control + message. The message is an error (red, announced),
 * a success line (green, once a value was confirmed valid) or a plain hint.
 * The control gets its id, `aria-describedby`, `aria-invalid` and the
 * `is-valid` class wired here so every page states fields the same way.
 */
export function AuthField({
  id,
  label,
  children,
  error,
  hint,
  success,
  aside,
}: {
  id: string;
  label: string;
  children: ReactElement<ControlProps>;
  error?: string | null;
  hint?: ReactNode;
  success?: string | null;
  /** Right side of the label row (e.g. "Forgot password?"). */
  aside?: ReactNode;
}) {
  const msgId = `${id}-msg`;
  const hasMessage = Boolean(error || success || hint);
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": hasMessage ? msgId : undefined,
        "aria-invalid": error ? true : undefined,
        className: cx(children.props.className, !error && success && "is-valid"),
      })
    : children;
  return (
    <div className={cx("f-auth-field", error && "has-error", !error && success && "has-success")}>
      <div className="f-auth-label-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      {control}
      <AuthFieldMessage id={msgId} error={error} success={success} hint={hint} />
    </div>
  );
}

export function AuthFieldMessage({
  id,
  error,
  success,
  hint,
}: {
  id: string;
  error?: string | null;
  success?: string | null;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <span id={id} className="f-auth-msg is-error" role="alert">
        <Glyph name="alert" size="sm" />
        {error}
      </span>
    );
  }
  if (success) {
    return (
      <span id={id} className="f-auth-msg is-ok">
        <Glyph name="check" size="sm" />
        {success}
      </span>
    );
  }
  if (hint) {
    return (
      <span id={id} className="f-auth-msg">
        {hint}
      </span>
    );
  }
  return null;
}

/** Text button for "Back to sign in", "Create an account"... */
export function AuthLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="f-auth-link" onClick={onClick}>
      {children}
    </button>
  );
}
