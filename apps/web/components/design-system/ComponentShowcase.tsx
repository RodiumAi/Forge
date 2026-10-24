"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { CSSProperties } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { SHOWCASE } from "./tokens";

type Props = {
  /** CSS custom properties of the design system (`cssVars`). */
  vars: Record<string, string>;
  components?: readonly string[];
};

/** Buttons, inputs, cards, badges, alerts and a table drawn live from the tokens. */
export function ComponentShowcase({ vars, components }: Props) {
  const { t } = useI18n();
  const shown = (components?.length ? components : SHOWCASE).filter((c) => (SHOWCASE as readonly string[]).includes(c));
  const blocks: Record<string, React.ReactNode> = {
    button: (
      <div className="dse-sc-row">
        <button type="button" className="dse-sc-btn is-primary">
          {t("dsShowcasePrimary")}
        </button>
        <button type="button" className="dse-sc-btn is-secondary">
          {t("dsShowcaseSecondary")}
        </button>
        <button type="button" className="dse-sc-btn is-ghost">
          {t("dsShowcaseGhost")}
        </button>
        <button type="button" className="dse-sc-btn is-primary" disabled>
          {t("dsShowcaseDisabled")}
        </button>
      </div>
    ),
    input: (
      <div className="dse-sc-row">
        <label className="dse-sc-field">
          {t("dsShowcaseEmail")}
          <input type="email" placeholder="nom@exemple.com" />
        </label>
        <label className="dse-sc-field is-error">
          {t("dsShowcasePassword")}
          <input type="password" defaultValue="secret" aria-invalid />
          <span>{t("dsShowcaseFieldError")}</span>
        </label>
      </div>
    ),
    card: (
      <div className="dse-sc-row">
        <article className="dse-sc-card">
          <span className="dse-sc-badge is-accent">{t("dsShowcaseBadge")}</span>
          <h4>{t("dsShowcaseCardTitle")}</h4>
          <p>{t("dsShowcaseCardBody")}</p>
          <button type="button" className="dse-sc-btn is-primary">
            {t("dsShowcasePrimary")}
          </button>
        </article>
      </div>
    ),
    badge: (
      <div className="dse-sc-row">
        <span className="dse-sc-badge is-accent">{t("dsShowcaseBadge")}</span>
        <span className="dse-sc-badge is-soft">{t("dsShowcasePending")}</span>
        <span className="dse-sc-badge is-success">{t("dsShowcaseActive")}</span>
        <span className="dse-sc-badge is-danger">{t("dsShowcaseLate")}</span>
      </div>
    ),
    alert: (
      <div className="dse-sc-stack">
        <div className="dse-sc-alert is-info" role="note">
          <Info aria-hidden size={18} /> {t("dsShowcaseAlertInfo")}
        </div>
        <div className="dse-sc-alert is-success" role="note">
          <CheckCircle2 aria-hidden size={18} /> {t("dsShowcaseAlertSuccess")}
        </div>
        <div className="dse-sc-alert is-danger" role="note">
          <AlertTriangle aria-hidden size={18} /> {t("dsShowcaseAlertDanger")}
        </div>
      </div>
    ),
    table: (
      <table className="dse-sc-table">
        <thead>
          <tr>
            <th>{t("dsShowcaseTableName")}</th>
            <th>{t("dsShowcaseTableStatus")}</th>
            <th>{t("dsShowcaseTableAmount")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Atlas</td>
            <td>
              <span className="dse-sc-badge is-success">{t("dsShowcaseActive")}</span>
            </td>
            <td className="is-num">1 240</td>
          </tr>
          <tr>
            <td>Borealis</td>
            <td>
              <span className="dse-sc-badge is-soft">{t("dsShowcasePending")}</span>
            </td>
            <td className="is-num">860</td>
          </tr>
        </tbody>
      </table>
    ),
  };
  return (
    <div className="dse-showcase" style={vars as CSSProperties} data-testid="ds-showcase">
      {shown.map((name) => (
        <section key={name} className="dse-sc-block" aria-label={name}>
          <div className="dse-sc-label">{name}</div>
          {blocks[name]}
        </section>
      ))}
    </div>
  );
}
