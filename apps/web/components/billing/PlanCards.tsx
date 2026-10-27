"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { Field, Input } from "@/components/ui/Input";
import { getToken } from "@/lib/api";
import { showsOnForge } from "@/lib/compare-surface";
import { forgeSubscribeReturnPath, forgeSubscriptionPayUrl } from "@/lib/constants/rodium-links";
import { planRelation, type ForgePlan, type PlanCompareRow } from "@/lib/forge-plans";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getSessionSnapshot } from "@/lib/session-cache";

function formatAmount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 0 }).format(n);
}

/** Feature lines of a card: the plan's comparison rows that are offered (yes or a value). */
function features(plan: ForgePlan, locale: string): string[] {
  const rows = (plan.entitlements.compare ?? []).filter(
    (row: PlanCompareRow) => row.visible !== false && row.kind && row.kind !== "no" && row.id !== "frodi" && showsOnForge(row.id, row),
  );
  return [...rows]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((row) => {
      const label = (locale === "fr" ? row.labelFr || row.label : row.label || row.labelFr) || row.id;
      if (row.kind === "yes") return label;
      const text = (locale === "fr" ? row.textFr || row.text : row.text || row.textFr) || "";
      return text ? `${label} : ${text}` : label;
    })
    .slice(0, 7);
}

function checkoutHref(plan: ForgePlan, country: string, seats: number | null): string {
  const rodiumSub = getSessionSnapshot()?.profile?.rodium_sub ?? null;
  if (!getToken() || !rodiumSub) {
    return `/login?next=${encodeURIComponent(
      forgeSubscribeReturnPath({ plan: plan.slug, currency: plan.currency, country, seats }),
    )}`;
  }
  return forgeSubscriptionPayUrl({ uid: rodiumSub, plan: plan.slug, currency: plan.currency, country, seats });
}

/** Team plans: how many seats (5 minimum), remembered for the team page, then the checkout. */
function SeatsDialog({ plan, country, onClose }: { plan: ForgePlan; country: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const min = plan.minSeats && plan.minSeats > 0 ? plan.minSeats : 5;
  const [count, setCount] = useState(min);
  const total = plan.priceConverted * count;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("apSeatsTitle")}
      description={t("apSeatsLead").replace("{n}", String(min))}
      closeLabel={t("uiClose")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("homeCancel")}
          </Button>
          <Button
            icon="card"
            onClick={() => {
              const mine = getSessionSnapshot()?.profile?.email?.trim() || "";
              try {
                localStorage.setItem("forge.teamSetup", JSON.stringify({ plan: plan.slug, seats: count, emails: mine ? [mine] : [] }));
              } catch {
                /* private mode */
              }
              window.location.assign(checkoutHref(plan, country, count));
            }}
          >
            {t("apSeatsContinue")}
          </Button>
        </>
      }
    >
      <Field label={t("apSeatsCount")} hint={`${formatAmount(total, locale)} ${plan.currency} ${t("apPerMonth")}`}>
        <Input
          data-autofocus
          type="number"
          min={min}
          max={500}
          value={count}
          onChange={(e) => setCount(Math.max(min, Math.min(500, Number(e.target.value) || min)))}
        />
      </Field>
    </Dialog>
  );
}

/**
 * The monthly plan cards of the billing page: price in the chosen currency,
 * FRODI per week (per month on Free), features from the plan's comparison
 * rows, "Your current plan" on the active one. Paid plans open the RodiumAi
 * checkout; Team plans ask for a seat count first.
 */
export function PlanCards({
  plans,
  current,
  country,
  hideFree = false,
}: {
  plans: ForgePlan[];
  current: string | null;
  country: string;
  hideFree?: boolean;
}) {
  const { t, locale } = useI18n();
  const [seatsFor, setSeatsFor] = useState<ForgePlan | null>(null);
  const shown = plans.filter((p) => !hideFree || p.slug !== "free" || p.slug === current);
  const featured = current ? null : "pro";

  return (
    <>
      <div className="f-plans">
        {shown.map((plan) => {
          const relation = planRelation(plan, plans, current);
          const team = plan.kind === "TEAM";
          const onSale = plan.listPrice != null && plan.listPrice > plan.priceConverted;
          const weekly = plan.cycle === "WEEKLY";
          return (
            <article
              key={plan.slug}
              className={cx("f-plan-card", relation === "current" && "is-current", plan.slug === featured && "is-featured")}
              data-plan={plan.slug}
            >
              <h3>
                {plan.name}
                {relation === "current" ? (
                  <span className="ribbon">{t("apCurrentPlan")}</span>
                ) : plan.slug === featured ? (
                  <span className="ribbon">{t("apPopular")}</span>
                ) : onSale && plan.promoName ? (
                  <span className="ribbon">{plan.promoName}</span>
                ) : null}
              </h3>
              <div className="amount">
                {onSale ? <s>{formatAmount(plan.listPrice as number, locale)}</s> : null}
                <b>{formatAmount(plan.priceConverted, locale)}</b>
                <span>
                  {plan.currency} {team ? t("apPerSeatMonth") : t("apPerMonth")}
                </span>
              </div>
              <p className="f-plan-card-sub">
                {t(weekly ? "apFrodiPerWeek" : "apFrodiPerMonth").replace("{n}", formatAmount(plan.frodiPerCycle, locale))}
                {team ? ` · ${t("apSeatsMin").replace("{n}", String(plan.minSeats ?? 5))}` : ""}
              </p>
              <ul>
                {features(plan, locale).map((line) => (
                  <li key={line}>
                    <Glyph name="check" size="sm" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {relation === "current" ? (
                <Button variant="ghost" disabled block>
                  {t("apYourCurrentPlan")}
                </Button>
              ) : relation === "past" || plan.slug === "free" ? (
                <Button variant="subtle" disabled block>
                  {plan.slug === "free" ? t("apFreePlan") : t("apIncluded")}
                </Button>
              ) : team ? (
                <Button block variant={plan.slug === featured ? "primary" : "dark"} onClick={() => setSeatsFor(plan)}>
                  {t("apChoosePlan").replace("{plan}", plan.name)}
                </Button>
              ) : (
                <Button block variant={plan.slug === featured ? "primary" : "dark"} href={checkoutHref(plan, country, null)}>
                  {t("apChoosePlan").replace("{plan}", plan.name)}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      {seatsFor ? <SeatsDialog plan={seatsFor} country={country} onClose={() => setSeatsFor(null)} /> : null}
    </>
  );
}
