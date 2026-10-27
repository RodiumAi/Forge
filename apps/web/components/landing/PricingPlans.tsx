"use client";

/**
 * Monthly pricing: country picker, six plan cards (3, 2, 1 per row; a swipe row
 * with dots on phones), the FRODI allowance and how often it renews on its own
 * line, and the comparison table. Everything comes from the plans API; the
 * comparison rows are the ones the admin writes, tagged "Forge + Code" when a
 * row also applies to RodiumAi Code. Shared by the landing (and any page that
 * shows the plans) through `currentSlug`-aware buttons.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { cx } from "@/components/ui/cx";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { Field, Input } from "@/components/ui/Input";
import { getToken } from "@/lib/api";
import type { BenefitSurface } from "@/lib/compare-surface";
import { forgeSubscribeResumeUrl } from "@/lib/constants/rodium-links";
import {
  compareRows,
  currencySign,
  formatAmount,
  orderedPlans,
  planCheckoutHref,
  planRelation,
  useForgePlans,
  usePricingCountry,
  type CompareCell,
  type CompareRow,
  type ForgePlan,
} from "@/lib/forge-pricing";
import { planSlugOf, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { ensureSession, getSessionSnapshot, subscribeSession } from "@/lib/session-cache";

const PLAN_GLYPH: Record<string, GlyphName> = {
  free: "sprout",
  starter: "rocket",
  builder: "hammer",
  pro: "zap",
  scale: "crown",
  "team-pro": "users",
};

const PLAN_TAG: Record<string, MessageKey> = {
  free: "lndTagFree",
  starter: "lndTagStarter",
  builder: "lndTagBuilder",
  pro: "lndTagPro",
  scale: "lndTagScale",
  "team-pro": "lndTagTeam",
};

/** Rows the cards leave out: FRODI has its own block, seats only matter for Team. */
function cardRows(rows: CompareRow[], plan: ForgePlan): CompareRow[] {
  return rows.filter((row) => row.id !== "frodi" && (row.id !== "seats" || plan.kind === "TEAM"));
}

function SurfaceTag({ surface }: { surface: BenefitSurface }) {
  const { t } = useI18n();
  if (surface === "forge") return null;
  return (
    <span className={cx("f-legend", surface === "both" ? "both" : "code")}>
      {surface === "both" ? t("lndLegendBoth") : t("lndLegendCode")}
    </span>
  );
}

function featureText(row: CompareRow, cell: CompareCell, locale: string): string {
  if (cell.kind !== "text") return row.label;
  const sep = locale === "fr" ? " : " : ": ";
  // A value that already names the benefit ("Unlimited projects") reads alone.
  return cell.text.toLowerCase().includes(row.label.toLowerCase().slice(0, 5)) ? cell.text : `${row.label}${sep}${cell.text}`;
}

/** The rodium_sub of the signed-in account (checkout links need it). */
function useRodiumSub(): { sub: string | null; ready: boolean } {
  const [sub, setSub] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const apply = (snap: { profile?: { rodium_sub?: string | null } | null } | null) => setSub(snap?.profile?.rodium_sub ?? null);
    apply(getSessionSnapshot());
    const unsub = subscribeSession(apply);
    let cancelled = false;
    if (getToken()) {
      void ensureSession().finally(() => {
        if (cancelled) return;
        apply(getSessionSnapshot());
        setReady(true);
      });
    } else setReady(true);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { sub, ready };
}

export function PricingPlans({ hideFree = false, compare = true }: { hideFree?: boolean; compare?: boolean }) {
  const { t, locale } = useI18n();
  const { country, countries, ready, select } = usePricingCountry();
  const { payload, error } = useForgePlans(country.currencyCode, ready);
  const forge = useForgeStatus();
  const currentSlug = getToken() ? planSlugOf(forge) : null;
  const { sub: rodiumSub, ready: subReady } = useRodiumSub();
  const [teamPlan, setTeamPlan] = useState<ForgePlan | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dot, setDot] = useState(0);
  const plansRef = useRef<HTMLDivElement>(null);

  // Back from sign-in with ?subscribe=...: continue to the pay page.
  useEffect(() => {
    if (!subReady || !rodiumSub || !getToken()) return;
    const next = forgeSubscribeResumeUrl(window.location.search, rodiumSub);
    if (next) window.location.assign(next);
  }, [subReady, rodiumSub]);

  const plans = useMemo(
    () => orderedPlans(payload?.plans ?? []).filter((p) => !(hideFree && p.slug === "free")),
    [payload, hideFree],
  );
  const rows = useMemo(() => compareRows(plans, locale), [plans, locale]);
  const frodiSurface = rows.find((r) => r.id === "frodi")?.surface ?? "both";
  const shownCurrency = plans[0]?.currency ?? country.currencyCode;
  const fallback = Boolean(payload?.fallback) || (plans.length > 0 && shownCurrency !== country.currencyCode);

  function onScroll() {
    const el = plansRef.current;
    const first = el?.querySelector<HTMLElement>(".f-plan");
    if (!el || !first) return;
    setDot(Math.round(el.scrollLeft / (first.offsetWidth + 14)));
  }

  function scrollTo(index: number) {
    const el = plansRef.current;
    const card = el?.querySelectorAll<HTMLElement>(".f-plan")[index];
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: "smooth" });
  }

  const price = (plan: ForgePlan) => formatAmount(plan.priceConverted, locale);

  function card(plan: ForgePlan) {
    const relation = planRelation(plan, plans, currentSlug);
    const popular = plan.slug === "pro";
    const team = plan.kind === "TEAM";
    const minSeats = plan.minSeats && plan.minSeats > 0 ? plan.minSeats : 5;
    const onSale = plan.listPrice != null && plan.listPrice > plan.priceConverted;
    const per = plan.slug === "free" ? t("lndPerForever") : team ? t("lndPerSeatMonth") : t("lndPerMonth");
    const weekly = plan.cycle === "WEEKLY";
    const tagKey = PLAN_TAG[plan.slug];
    const ctaLabel =
      plan.slug === "free" ? t("lndCtaFree") : team ? t("lndCtaTeam") : t("lndCtaPlan").replace("{p}", plan.name);
    return (
      <article
        key={plan.slug}
        className={cx("f-plan", popular && "is-popular", relation === "current" && "is-current", relation === "past" && "is-past")}
        aria-label={plan.name}
      >
        {relation === "current" ? (
          <span className="f-plan-pill current">
            <Glyph name="check" size="sm" />
            {t("lndCurrent")}
          </span>
        ) : popular ? (
          <span className="f-plan-pill">
            <Glyph name="star" size="sm" />
            {t("lndPopular")}
          </span>
        ) : null}
        <div className="f-plan-top">
          <span className="f-plan-icon">
            <Glyph name={PLAN_GLYPH[plan.slug] ?? "sparkles"} />
          </span>
          <h3>{plan.name}</h3>
        </div>
        {tagKey ? <p className="f-plan-tag">{t(tagKey).replace("{n}", String(minSeats))}</p> : null}
        <div className="f-price">
          {onSale ? <span className="was">{t("lndWas").replace("{p}", formatAmount(plan.listPrice!, locale))}</span> : null}
          <span className="amount">{price(plan)}</span>
          <span className="cur">{currencySign(plan.currency)}</span>
          {onSale && plan.promoName ? (
            <span className="promo">
              {plan.promoName}
              {plan.promoEndsAt ? ` · ${t("lndPromoUntil").replace("{date}", new Date(plan.promoEndsAt).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR"))}` : ""}
            </span>
          ) : null}
          <span className="per">{per}</span>
        </div>
        {relation === "current" ? (
          <span className="f-btn f-btn-subtle f-plan-cta" aria-disabled="true">
            <Glyph name="check" size="sm" />
            {t("lndCurrentPlan")}
          </span>
        ) : relation === "past" ? (
          <span className="f-btn f-btn-subtle f-plan-cta" aria-disabled="true">
            {t("lndCtaPast")}
          </span>
        ) : team ? (
          <Button className="f-plan-cta" onClick={() => setTeamPlan(plan)}>
            {ctaLabel}
          </Button>
        ) : (
          <Button
            className="f-plan-cta"
            variant={plan.slug === "free" ? "subtle" : "primary"}
            href={planCheckoutHref(plan, rodiumSub, country.iso2)}
          >
            {ctaLabel}
          </Button>
        )}
        <div className="f-frodi">
          <Glyph name="zap" size="sm" />
          <div>
            <div className="val">{formatAmount(plan.frodiPerCycle, locale)}</div>
            <div className="lbl">{weekly ? t("lndFrodiWeek") : t("lndFrodiMonth")}</div>
          </div>
          <SurfaceTag surface={frodiSurface} />
        </div>
        <ul className="f-feats">
          {cardRows(rows, plan).map((row) => {
            const cell = row.value(plan);
            const no = cell.kind === "no";
            return (
              <li key={row.id} className={no ? "no" : undefined}>
                <span className="ck">
                  <Glyph name={no ? "minus" : "check"} size="sm" label={no ? t("lndNo") : t("lndYes")} />
                </span>
                <span className="ft">
                  {featureText(row, cell, locale)}
                  <SurfaceTag surface={row.surface} />
                </span>
              </li>
            );
          })}
        </ul>
      </article>
    );
  }

  function cellView(cell: CompareCell) {
    if (cell.kind === "yes") {
      return (
        <span className="yes">
          <Glyph name="check" size="sm" label={t("lndYes")} />
        </span>
      );
    }
    if (cell.kind === "no") {
      return (
        <span className="no">
          <Glyph name="minus" size="sm" label={t("lndNo")} />
        </span>
      );
    }
    return cell.text;
  }

  return (
    <div className="f-pricing">
      <div className="f-pr-meta">
        <CountryPicker value={country.iso2} countries={countries} onChange={(iso) => select(iso)} />
        <span>
          <span className="f-legend both">{t("lndLegendBoth")}</span>
          <span className="f-legend forge">{t("lndLegendForge")}</span>
        </span>
      </div>
      <p className="f-pr-note">
        {fallback
          ? t("lndPriceFallback").replace("{c}", country.currencyCode).replace("{d}", currencySign(shownCurrency))
          : ""}
        {t("lndLegendText")}
      </p>

      {plans.length === 0 ? (
        error ? (
          <p className="f-pr-note" role="alert">
            {t("lndPlansError")}
          </p>
        ) : (
          <div className="f-plans" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="f-skel f-pr-skel" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="f-plans" ref={plansRef} onScroll={onScroll}>
            {plans.map(card)}
          </div>
          <div className="f-plan-dots" role="group" aria-label={t("lndPlanDots")}>
            {plans.map((plan, i) => (
              <button
                key={plan.slug}
                type="button"
                aria-label={plan.name}
                aria-current={i === dot ? "true" : undefined}
                onClick={() => scrollTo(i)}
              />
            ))}
          </div>
          {compare ? (
            <>
              <div className="f-compare-toggle">
                <Button
                  variant="ghost"
                  iconEnd={compareOpen ? "chevron-down" : "chevron-right"}
                  aria-expanded={compareOpen}
                  aria-controls="f-compare"
                  onClick={() => setCompareOpen((v) => !v)}
                >
                  {compareOpen ? t("lndCompareHide") : t("lndCompareShow")}
                </Button>
              </div>
              <div className="f-compare" id="f-compare" hidden={!compareOpen}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("lndFeature")}</th>
                      {plans.map((plan) => (
                        <th scope="col" key={plan.slug} className={plan.slug === "pro" ? "col-pop" : undefined}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{t("lndPricePerMonth")}</th>
                      {plans.map((plan) => (
                        <td key={plan.slug} className={plan.slug === "pro" ? "col-pop" : undefined}>
                          {price(plan)} {currencySign(plan.currency)}
                          {plan.kind === "TEAM" ? ` ${t("lndPerSeatShort")}` : ""}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">
                        {t("lndFrodiAllowance")} <SurfaceTag surface={frodiSurface} />
                      </th>
                      {plans.map((plan) => (
                        <td key={plan.slug} className={plan.slug === "pro" ? "col-pop" : undefined}>
                          {formatAmount(plan.frodiPerCycle, locale)}{" "}
                          {plan.cycle === "WEEKLY" ? t("lndPerWeekShort") : t("lndPerMonthShort")}
                        </td>
                      ))}
                    </tr>
                    {rows
                      .filter((row) => row.id !== "frodi")
                      .map((row) => (
                        <tr key={row.id}>
                          <th scope="row">
                            {row.label} <SurfaceTag surface={row.surface} />
                          </th>
                          {plans.map((plan) => (
                            <td key={plan.slug} className={plan.slug === "pro" ? "col-pop" : undefined}>
                              {cellView(row.value(plan))}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}

      {teamPlan ? (
        <TeamSeatsDialog plan={teamPlan} countryIso={country.iso2} rodiumSub={rodiumSub} onClose={() => setTeamPlan(null)} />
      ) : null}
    </div>
  );
}

/** Team Pro: pick the seat count (minimum from the plan) and who to invite, then pay. */
function TeamSeatsDialog({
  plan,
  countryIso,
  rodiumSub,
  onClose,
}: {
  plan: ForgePlan;
  countryIso: string;
  rodiumSub: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const min = plan.minSeats && plan.minSeats > 0 ? plan.minSeats : 5;
  const mine = getSessionSnapshot()?.profile?.email?.trim() || "";
  const [count, setCount] = useState(min);
  const [emails, setEmails] = useState<string[]>(() => Array.from({ length: min }, (_, i) => (i === 0 ? mine : "")));

  function setSeatCount(next: number) {
    const safe = Math.max(min, Number.isFinite(next) ? Math.floor(next) : min);
    setCount(safe);
    setEmails((prev) => {
      const copy = prev.slice(0, safe);
      while (copy.length < safe) copy.push("");
      if (mine) copy[0] = mine;
      return copy;
    });
  }

  const empty = Math.max(0, count - emails.filter((e) => e.trim()).length);

  function continueToPay() {
    try {
      localStorage.setItem(
        "forge.teamSetup",
        JSON.stringify({ plan: plan.slug, seats: count, emails: emails.map((e) => e.trim()).filter(Boolean) }),
      );
    } catch {
      /* private mode */
    }
    window.location.assign(planCheckoutHref(plan, rodiumSub, countryIso, count));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("teamSeatsTitle")}
      description={t("teamSeatsHelp")}
      closeLabel={t("uiClose")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("uiClose")}
          </Button>
          <Button type="submit" form="f-team-seats">
            {t("teamSeatContinue")}
          </Button>
        </>
      }
    >
      <form
        id="f-team-seats"
        className="f-team-seats"
        onSubmit={(event) => {
          event.preventDefault();
          continueToPay();
        }}
      >
        <Field label={t("teamSeatsCount")}>
          <Input type="number" min={min} value={count} onChange={(e) => setSeatCount(Number(e.target.value))} data-autofocus />
        </Field>
        <div className="emails">
          {emails.map((email, index) => (
            <Field key={index} label={index === 0 ? t("teamSeatYou") : t("teamSeatEmail").replace("{n}", String(index + 1))}>
              <Input
                type="email"
                value={email}
                readOnly={index === 0 && Boolean(mine)}
                placeholder="email@exemple.com"
                onChange={(e) => setEmails((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
              />
            </Field>
          ))}
        </div>
        <p className="f-muted">{t("teamSeatEmpty").replace("{n}", String(empty))}</p>
      </form>
    </Dialog>
  );
}
