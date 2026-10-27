"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import "@/styles/forge/pages.css";

import { PlanCards } from "@/components/billing/PlanCards";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { AppShell } from "@/components/shell/AppShell";
import { daysUntil, formatCount } from "@/components/shell/FrodiCard";
import { APP_ROUTES } from "@/components/shell/nav";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { Glyph } from "@/components/ui/glyph";
import { StairsMeter } from "@/components/ui/Meter";
import { api, getToken } from "@/lib/api";
import { rodiumRechargeUrl, rodiumUserAppOrigin } from "@/lib/constants/rodium-links";
import { usePaymentCountry, useForgePlans } from "@/lib/forge-plans";
import { useForgeStatus } from "@/lib/forge-status";
import { frodiUsage } from "@/lib/frodi-usage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import { getSessionSnapshot, subscribeSession } from "@/lib/session-cache";

type UsageWeek = { start: string; counts: Partial<Record<ProjectKindId, number>> };
type RodiumWallet = { linked?: boolean; rodium_sub?: string | null; wallet?: { balance_rodi?: string | null } | null };

const KIND_ORDER: ProjectKindId[] = ["web", "slides", "mobile", "codelab", "design_system"];

function amount(value: number | string | null | undefined, locale: string): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 2 }).format(n);
}

/** Generations per week and kind over the last six weeks (GET /workspace/usage). */
function UsagePanel() {
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const [weeks, setWeeks] = useState<UsageWeek[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ weeks: UsageWeek[] }>("/workspace/usage?weeks=6", { retries: 0 })
      .then((body) => alive && setWeeks(Array.isArray(body?.weeks) ? body.weeks : []))
      .catch(() => alive && setWeeks([]));
    return () => {
      alive = false;
    };
  }, []);
  const kinds = KIND_ORDER.filter((k) => enabledKinds.includes(k));
  const totals = (weeks ?? []).map((w) => kinds.reduce((sum, k) => sum + (w.counts[k] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const all = totals.reduce((a, b) => a + b, 0);
  const fmtWeek = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });

  return (
    <section className="f-panel">
      <h2>{t("apUsageTitle")}</h2>
      <p className="f-panel-lead">{t("apUsageLead")}</p>
      {weeks === null ? (
        <div className="f-skel" style={{ height: 150, borderRadius: 12, margin: "22px 0 14px" }} />
      ) : (
        <>
          <div className="f-usage-bars" role="img" aria-label={t("apUsageAria").replace("{n}", String(all))}>
            {weeks.map((w, i) => (
              <div className="w" key={w.start}>
                <div
                  className="stack"
                  style={{ height: `${Math.max(4, Math.round((totals[i] / max) * 115))}px` }}
                  title={`${fmtWeek(w.start)} · ${totals[i]}`}
                >
                  {kinds.map((k) =>
                    w.counts[k] ? (
                      <i key={k} style={{ height: `${((w.counts[k] ?? 0) / Math.max(1, totals[i])) * 100}%`, background: kindStyle(k).color }} />
                    ) : null,
                  )}
                </div>
                <span>{i === weeks.length - 1 ? t("apThisWeek") : fmtWeek(w.start)}</span>
              </div>
            ))}
          </div>
          {all ? (
            <div className="f-legend-row">
              {kinds.map((k) => (
                <span key={k}>
                  <i style={{ background: kindStyle(k).color }} />
                  {t(kindStyle(k).labelKey)}
                </span>
              ))}
            </div>
          ) : (
            <p className="f-note">{t("apUsageEmpty")}</p>
          )}
        </>
      )}
    </section>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const usage = frodiUsage(status);
  const plan = status?.plan ?? status?.entitlements?.plan_slug ?? null;
  const monthlyFrodi = plan === "free";
  const days = daysUntil(usage?.resetsAt);
  const { iso, currency, setCountry } = usePaymentCountry();
  const { plans, error: plansError } = useForgePlans(currency);
  const [wallet, setWallet] = useState<RodiumWallet | null>(null);
  const [rodiumSub, setRodiumSub] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login?next=/billing");
      return;
    }
    setRodiumSub(getSessionSnapshot()?.profile?.rodium_sub ?? null);
    const unsub = subscribeSession((snap) => setRodiumSub(snap?.profile?.rodium_sub ?? null));
    let alive = true;
    api<RodiumWallet>("/auth/rodium/account", { retries: 0 })
      .then((body) => alive && setWallet(body))
      .catch(() => alive && setWallet({ linked: false }));
    return () => {
      alive = false;
      unsub();
    };
  }, [router]);

  // The plan section is the target of every "upgrade" link (#plans).
  useEffect(() => {
    if (window.location.hash !== "#plans" || !plans) return;
    window.setTimeout(() => document.getElementById("plans")?.scrollIntoView(), 80);
  }, [plans]);

  const currentPlan = useMemo(() => plans?.find((p) => p.slug === plan) ?? null, [plans, plan]);
  const balance = amount(wallet?.wallet?.balance_rodi ?? (status?.rodi != null ? status.rodi : null), locale);
  const sub = wallet?.rodium_sub ?? rodiumSub;
  const accountBilling = `${rodiumUserAppOrigin()}/dashboard/billing`;
  const returnTo = typeof window !== "undefined" ? `${window.location.origin}/billing` : undefined;

  return (
    <AppShell active="billing" title={t("uiNavBilling")}>
      <div className="f-page-head">
        <div>
          <h1>{t("apBillingTitle")}</h1>
          <p>{t("apBillingLead")}</p>
        </div>
      </div>

      <div className="f-bill-hero">
        <article className="f-cur-plan">
          <span className="chip">
            <Glyph name="crown" size="sm" />
            {t("apCurrentPlan")}
          </span>
          <h2>{planDisplayName(plan) ?? (status ? t("uiPlanUnknown") : "...")}</h2>
          {currentPlan ? (
            <div className="price">
              <b>{amount(currentPlan.priceConverted, locale)}</b> {currentPlan.currency}{" "}
              <span className="muted">{currentPlan.kind === "TEAM" ? t("apPerSeatMonth") : t("apPerMonth")}</span>
            </div>
          ) : null}
          <p className="muted">{monthlyFrodi ? t("apCurPlanFreeNote") : t("apCurPlanNote")}</p>
          <div className="acts">
            <Button variant="primary" href="#plans">
              {t("apChangePlan")}
            </Button>
            <Button variant="ghost" href={accountBilling} external iconEnd="arrow-right">
              {t("apManageOnRodium")}
            </Button>
          </div>
        </article>

        <section className="f-panel" style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="f-card-head" style={{ flexWrap: "wrap" }}>
            <h2>{monthlyFrodi ? t("apFrodiMonth") : t("apFrodiWeek")}</h2>
            {days != null ? (
              <Tag tone="orange">{days === 0 ? t("apRenewToday") : t("apRenewIn").replace("{n}", String(days))}</Tag>
            ) : null}
          </div>
          {usage ? (
            <>
              <div className="f-usage-num">
                <b>{formatCount(usage.remaining, locale)}</b>
                <span>
                  / {formatCount(usage.grant, locale)} {t("apLeft")}
                </span>
              </div>
              <StairsMeter
                value={usage.grant ? usage.remaining / usage.grant : 0}
                label={monthlyFrodi ? t("uiFrodiLeftMonth") : t("uiFrodiLeftWeek")}
                valueText={`${formatCount(usage.remaining, locale)} / ${formatCount(usage.grant, locale)}`}
                steps={20}
                size="lg"
              />
              <div className="f-meter-legend-row">
                <span>0</span>
                <span>{t("apFrodiFallback")}</span>
              </div>
            </>
          ) : (
            <p className="f-note">{t("apFrodiUnavailable")}</p>
          )}
        </section>
      </div>

      <div className="f-grid-3" style={{ marginTop: 16 }}>
        <UsagePanel />

        <section className="f-panel" id="rodi" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2>{t("apRodiTitle")}</h2>
          <div className="f-usage-num">
            <b>{balance ?? (wallet ? "-" : "...")}</b>
            <span>RODI</span>
          </div>
          <p className="f-panel-lead">{t("apRodiLead")}</p>
          <div className="f-actions-row">
            <Button size="sm" icon="plus" href={rodiumRechargeUrl(sub, returnTo)} external>
              {t("apTopUp")}
            </Button>
            <Button size="sm" variant="ghost" href={`${APP_ROUTES.settings}#rodiumai`}>
              {t("apUseRodi")}
            </Button>
          </div>
        </section>

        <section className="f-panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2>{t("apPaymentTitle")}</h2>
          <div className="f-field">
            <label>{t("uiCountryLabel")}</label>
            <CountryPicker value={iso} onChange={(next) => setCountry(next)} align="start" />
          </div>
          <p className="f-note">{t("apPayMethodNote")}</p>
        </section>
      </div>

      <section id="plans" style={{ marginTop: 44, scrollMarginTop: 90 }}>
        <div className="f-plans-head">
          <div>
            <h2 style={{ fontSize: "clamp(22px, 2.4vw, 28px)", letterSpacing: "-.02em" }}>{t("apChangePlan")}</h2>
            <p className="f-note">{t("apPlansLead")}</p>
          </div>
        </div>
        {plans?.length ? (
          <PlanCards plans={plans} current={plan} country={iso} hideFree />
        ) : plansError ? (
          <p className="f-error">{t("apPlansError")}</p>
        ) : (
          <div className="f-plans" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="f-skel" style={{ height: 320, borderRadius: 24 }} />
            ))}
          </div>
        )}
      </section>

      <section className="f-panel" style={{ marginTop: 28 }}>
        <div className="f-row-line">
          <div className="l">
            <b>{t("apInvoicesTitle")}</b>
            <small>{t("apInvoicesLead")}</small>
          </div>
          <div className="r">
            <Button variant="ghost" size="sm" icon="receipt" href={accountBilling} external>
              {t("apInvoicesOpen")}
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
