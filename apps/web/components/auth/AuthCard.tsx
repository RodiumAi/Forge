"use client";

/**
 * The centred card every auth screen sits in.
 *
 * Extracted so sign-in, sign-up, password reset and email confirmation share
 * one layout instead of five near-copies of the same inline styles. Matches
 * the card the RodiumAi sign-in page already used, so the two do not look
 * like different products mid-flow.
 */

import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";

export function AuthCard({
  title,
  subtitle,
  error,
  notice,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  notice?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <div className="header-locale">
            <LocaleSwitch />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <BrandLogo alt={t("brandAlt")} width={220} height={64} priority />
          <h1
            style={{
              margin: "0.85rem 0 0.35rem",
              fontSize: "1.25rem",
              fontFamily: "var(--font-serif-display)",
              fontWeight: 600,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="muted" style={{ margin: 0 }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="error" style={{ marginBottom: "0.75rem" }} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        ) : null}

        {children}

        {footer ? <div style={{ marginTop: "1.25rem" }}>{footer}</div> : null}
      </div>
    </div>
  );
}

/** Horizontal rule with a word in the middle, between social and credentials. */
export function AuthDivider() {
  const { t } = useI18n();
  return (
    <div className="auth-divider" aria-hidden="true">
      <span>{t("authOr")}</span>
    </div>
  );
}

export function AuthField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
