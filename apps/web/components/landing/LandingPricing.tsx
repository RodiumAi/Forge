"use client";

import { CountryCurrencySelect, type PricingCountry } from "@/components/landing/CountryCurrencySelect";
import { api, getToken } from "@/lib/api";
import {
  forgeSubscribeResumeUrl,
  forgeSubscribeReturnPath,
  forgeSubscriptionPayUrl,
} from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useForgeStatus } from "@/lib/forge-status";
import { ensureSession, getSessionSnapshot, subscribeSession } from "@/lib/session-cache";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

type Entitlements = {
  max_projects?: number | null;
  model_selection?: boolean;
  custom_domain?: boolean;
  export?: boolean;
  history?: boolean | "limited";
  priority_generation?: boolean;
};

type ApiPlan = {
  slug: string;
  name: string;
  priceConverted: number;
  listPrice?: number;
  promoEndsAt?: string | null;
  promoName?: string | null;
  currency: string;
  frodiPerCycle: number;
  cycle: string;
  kind: string;
  minSeats: number | null;
  sortOrder?: number;
  entitlements: Entitlements;
};

const FALLBACK_COUNTRIES: PricingCountry[] = [
  { iso2: "TG", name: "Togo", currencyCode: "XOF" },
  { iso2: "SN", name: "Sénégal", currencyCode: "XOF" },
  { iso2: "CI", name: "Côte d’Ivoire", currencyCode: "XOF" },
  { iso2: "GH", name: "Ghana", currencyCode: "GHS" },
  { iso2: "NG", name: "Nigeria", currencyCode: "NGN" },
  { iso2: "CM", name: "Cameroun", currencyCode: "XAF" },
  { iso2: "KE", name: "Kenya", currencyCode: "KES" },
];

const DEFAULT_COUNTRY = "TG";
const PRICING_COUNTRY_KEY = "forge.pricingCountry";
const PRICING_CATALOGUE_KEY = "forge.pricingCatalogue.v1";

type CatalogueCache = {
  byCurrency: Record<string, ApiPlan[]>;
  currencyByCountry: Record<string, string>;
};

function emptyCatalogue(): CatalogueCache {
  return { byCurrency: {}, currencyByCountry: {} };
}

function isCachedPlan(value: unknown): value is ApiPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as ApiPlan;
  return (
    typeof plan.slug === "string" &&
    typeof plan.name === "string" &&
    typeof plan.priceConverted === "number" &&
    typeof plan.currency === "string" &&
    plan.entitlements != null &&
    typeof plan.entitlements === "object"
  );
}

function readCatalogue(): CatalogueCache {
  if (typeof window === "undefined") return emptyCatalogue();
  try {
    const raw = localStorage.getItem(PRICING_CATALOGUE_KEY);
    if (!raw) return emptyCatalogue();
    const parsed = JSON.parse(raw) as Partial<CatalogueCache>;
    const byCurrency: Record<string, ApiPlan[]> = {};
    for (const [currency, plans] of Object.entries(parsed.byCurrency ?? {})) {
      if (Array.isArray(plans) && plans.length > 0 && plans.every(isCachedPlan)) {
        byCurrency[currency] = plans;
      }
    }
    const currencyByCountry: Record<string, string> = {};
    for (const [iso, currency] of Object.entries(parsed.currencyByCountry ?? {})) {
      if (/^[A-Z]{2}$/.test(iso) && typeof currency === "string" && byCurrency[currency]) {
        currencyByCountry[iso] = currency;
      }
    }
    return { byCurrency, currencyByCountry };
  } catch {
    return emptyCatalogue();
  }
}

function writeCatalogue(cache: CatalogueCache) {
  try {
    localStorage.setItem(PRICING_CATALOGUE_KEY, JSON.stringify(cache));
  } catch {
    /* private mode or quota */
  }
}

function readCachedPlans(currency: string): ApiPlan[] | null {
  return readCatalogue().byCurrency[currency] ?? null;
}

function currencyForCountry(iso: string, countries: PricingCountry[] = FALLBACK_COUNTRIES): string | null {
  return (
    countries.find((country) => country.iso2 === iso)?.currencyCode ??
    readCatalogue().currencyByCountry[iso] ??
    null
  );
}

function rememberCatalogue(currency: string, plans: ApiPlan[], countryIso?: string) {
  const cache = readCatalogue();
  cache.byCurrency[currency] = plans;
  if (countryIso) cache.currencyByCountry[countryIso] = currency;
  writeCatalogue(cache);
}

function readStoredCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(PRICING_COUNTRY_KEY)?.trim().toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredCountry(iso: string) {
  try {
    localStorage.setItem(PRICING_COUNTRY_KEY, iso);
  } catch {
    /* private mode */
  }
}

function PlanPrice({
  item,
  period,
  untilLabel,
}: {
  item: ApiPlan;
  period: string;
  untilLabel: string;
}) {
  const onSale = item.listPrice != null && item.listPrice > item.priceConverted;
  const ends = item.promoEndsAt ? item.promoEndsAt.slice(0, 10) : "";
  return (
    <p className="lp-compare-price">
      {onSale && item.promoName ? (
        <span className="lp-promo-badge">{item.promoName}</span>
      ) : null}
      <span className="lp-price-now">
        {onSale ? <s>{formatAmount(item.listPrice!)}</s> : null}
        <strong>{formatAmount(item.priceConverted)}</strong>
      </span>
      <span>
        {item.currency}
        {period}
      </span>
      {onSale && ends ? (
        <span className="mt-1 block text-xs">{untilLabel.replace("{date}", ends)}</span>
      ) : null}
    </p>
  );
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
}

function PricingSkeleton({ columns }: { columns: number }) {
  const heads = Array.from({ length: columns }, (_, index) => index);
  const lines = Array.from({ length: 8 }, (_, index) => index);
  return (
    <>
      <div
        className="lp-compare lp-pricing-skeleton"
        style={{ ["--plan-count" as string]: columns }}
        aria-hidden
      >
        <div className="lp-compare-head">
          <div className="lp-compare-corner">
            <span className="lp-skel" />
          </div>
          {heads.map((index) => (
            <div className="lp-compare-plan" key={index}>
              <span className="lp-skel is-short" />
              <span className="lp-skel is-price" />
              <span className="lp-skel is-button" />
            </div>
          ))}
        </div>
        {lines.map((row) => (
          <div className="lp-compare-row" key={row}>
            <div className="lp-compare-label">
              <span className="lp-skel" />
            </div>
            {heads.map((column) => (
              <div className="lp-compare-cell" key={column}>
                <span className="lp-skel is-cell" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="lp-plan-cards lp-pricing-skeleton" aria-hidden>
        {heads.map((index) => (
          <article className="lp-plan-card" key={index}>
            <span className="lp-skel is-short" />
            <span className="lp-skel is-price" />
            <span className="lp-skel is-button" />
            {lines.slice(0, 5).map((row) => (
              <span className="lp-skel" key={row} />
            ))}
          </article>
        ))}
      </div>
    </>
  );
}

export function LandingPricing({ hideFree = false }: { hideFree?: boolean }) {
  const { t, locale } = useI18n();
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY);
  const [countries, setCountries] = useState<PricingCountry[]>(FALLBACK_COUNTRIES);
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);
  const [countryReady, setCountryReady] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [teamOffer, setTeamOffer] = useState<ApiPlan | null>(null);

  useLayoutEffect(() => {
    const iso = readStoredCountry() ?? DEFAULT_COUNTRY;
    const code = currencyForCountry(iso);
    const cached = code ? readCachedPlans(code) : null;
    if (cached) setPlans(cached);
  }, []);
  const currency =
    countries.find((country) => country.iso2 === countryIso)?.currencyCode ?? "XOF";

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredCountry();
    if (stored) setCountryIso(stored);
    void (async () => {
      try {
        const [countriesResponse, geoResponse] = await Promise.all([
          fetch("/api/payment-countries"),
          fetch("/api/visitor-country"),
        ]);
        if (cancelled) return;
        const countriesBody = await countriesResponse.json();
        const geoBody = await geoResponse.json();
        const list =
          Array.isArray(countriesBody) && countriesBody.length > 0
            ? (countriesBody as PricingCountry[])
            : FALLBACK_COUNTRIES;
        const known = (iso: string | null | undefined) =>
          list.find((country) => country.iso2 === (iso ?? "").toUpperCase())?.iso2 ?? null;
        let account: string | null = null;
        if (getToken()) {
          await ensureSession({ force: true });
          account = known(getSessionSnapshot()?.profile?.payment_country_iso);
        }
        if (cancelled) return;
        setCountries(list);
        if (account) {
          setCountryIso(account);
          writeStoredCountry(account);
          return;
        }
        const remembered = known(stored);
        if (remembered) {
          setCountryIso(remembered);
          if (getToken()) {
            void api("/settings/payment-country", {
              method: "PATCH",
              body: JSON.stringify({ iso2: remembered }),
            }).catch(() => undefined);
          }
          return;
        }
        const detected = known(String((geoBody as { iso2?: string })?.iso2 || ""));
        const fallback = known(DEFAULT_COUNTRY) ?? list[0]?.iso2 ?? DEFAULT_COUNTRY;
        setCountryIso(detected ?? fallback);
      } catch {
        if (!cancelled) setCountryIso(readStoredCountry() ?? DEFAULT_COUNTRY);
      } finally {
        if (!cancelled) setCountryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectCountry(iso: string) {
    const nextCurrency = countries.find((country) => country.iso2 === iso)?.currencyCode;
    if (nextCurrency && nextCurrency !== currency) {
      setPlans(readCachedPlans(nextCurrency));
      setPlansError(false);
    }
    setCountryIso(iso);
    writeStoredCountry(iso);
    if (!getToken()) return;
    void api("/settings/payment-country", {
      method: "PATCH",
      body: JSON.stringify({ iso2: iso }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (!countryReady) return;
    let cancelled = false;
    const cached = readCachedPlans(currency);
    if (cached) setPlans(cached);
    else setPlans(null);
    setPlansError(false);
    void fetch(`/api/forge-plans?currency=${currency}`)
      .then((response) => response.json())
      .then((body: { plans?: ApiPlan[] }) => {
        if (cancelled) return;
        if (!body.plans?.length) {
          if (!cached) setPlansError(true);
          return;
        }
        rememberCatalogue(currency, body.plans, countryIso);
        if (JSON.stringify(cached) !== JSON.stringify(body.plans)) setPlans(body.plans);
      })
      .catch(() => {
        if (!cancelled && !cached) setPlansError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, countryReady, countryIso]);

  const columns = useMemo(() => {
    const bySlug = new Map((plans ?? []).map((item) => [item.slug, item]));
    const order = ["free", "starter", "builder", "pro", "scale", "team-pro"];
    return order
      .filter((slug) => !(hideFree && slug === "free"))
      .map((slug) => bySlug.get(slug))
      .filter((item): item is ApiPlan => Boolean(item))
      .map((item) => ({
        ...item,
        name: item.slug === "team-pro" ? "Team" : item.name,
        entitlements:
          item.slug === "starter"
            ? { ...item.entitlements, export: false }
            : item.entitlements,
      }));
  }, [plans, hideFree]);

  const [rodiumSub, setRodiumSub] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const forge = useForgeStatus();
  const currentSlug = forge?.plan ?? forge?.entitlements?.plan_slug ?? null;

  useEffect(() => {
    const apply = (snap: { profile?: { rodium_sub?: string | null } | null } | null) => {
      setRodiumSub(snap?.profile?.rodium_sub ?? null);
    };
    apply(getSessionSnapshot());
    const unsub = subscribeSession(apply);
    let cancelled = false;
    void ensureSession().finally(() => {
      if (!cancelled) {
        apply(getSessionSnapshot());
        setSessionReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || !rodiumSub || !getToken()) return;
    const next = forgeSubscribeResumeUrl(window.location.search, rodiumSub);
    if (!next) return;
    window.location.assign(next);
  }, [sessionReady, rodiumSub]);

  const rows = useMemo(
    () => buildCompareRows(columns, locale, t),
    [columns, locale, t],
  );

  const compareLabels = {
    yes: t("landingCompareYes"),
    no: t("landingCompareNo"),
  };

  return (
    <section className="lp-pricing" id="pricing">
      <div className="lp-pricing-head">
        <div>
          <h2 className="lp-section-title">{t("landingPricingTitle")}</h2>
          <p className="lp-pricing-sub">{t("landingPricingSub")}</p>
        </div>
        <CountryCurrencySelect
          countries={countries}
          value={countryIso}
          onChange={selectCountry}
          label={t("landingPricingCountry")}
          searchPlaceholder={t("landingPricingCountrySearch")}
          emptyLabel={t("landingPricingCountryEmpty")}
        />
      </div>

      {plans === null && !plansError ? (
        <PricingSkeleton columns={hideFree ? 5 : 6} />
      ) : plansError || !plans ? (
        <p className="lp-pricing-sub">
          {locale === "fr"
            ? "Les tarifs n’ont pas pu être chargés."
            : "Plans could not be loaded."}
        </p>
      ) : (
      <>
      <div className="lp-compare" style={{ ["--plan-count" as string]: columns.length }}>
        <div className="lp-compare-head">
          <div className="lp-compare-corner">{t("landingCompareQuestion")}</div>
          {columns.map((item) => (
            <div
              key={item.slug}
              className={`lp-compare-plan${item.slug === "pro" ? " is-featured" : ""}${
                planRelation(item, columns, currentSlug) === "past" ? " is-past" : ""
              }`}
            >
              {item.slug === "pro" ? (
                <span className="lp-compare-badge">{t("landingPricingPopular")}</span>
              ) : (
                <span className="lp-compare-badge lp-compare-badge-spacer" aria-hidden />
              )}
              <h3>{item.name}</h3>
              <PlanPrice
                item={item}
                period={item.kind === "TEAM" ? t("landingPricingSeat") : t("landingPricingMonth")}
                untilLabel={t("landingPricingPromoUntil")}
              />
              <PlanCta
                item={item}
                columns={columns}
                currentSlug={currentSlug}
                rodiumSub={rodiumSub}
                countryIso={countryIso}
                subscribeLabel={t("landingPricingCta")}
                freeLabel={t("landingPricingFreeCta")}
                currentLabel={t("landingPricingCurrent")}
                onTeam={setTeamOffer}
              />
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div className="lp-compare-row" key={row.label}>
            <div className="lp-compare-label">{row.label}</div>
            {columns.map((item) => {
              const cell = row.value(item);
              return (
                <div className="lp-compare-cell" key={item.slug}>
                  {renderCompareCell(cell, compareLabels)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="lp-plan-cards">
        {columns.map((item) => (
          <article
            key={item.slug}
            className={`lp-plan-card${item.slug === "pro" ? " is-featured" : ""}${
              planRelation(item, columns, currentSlug) === "past" ? " is-past" : ""
            }`}
          >
            <div className="lp-plan-card-head">
              <div>
                {item.slug === "pro" ? (
                  <span className="lp-compare-badge">{t("landingPricingPopular")}</span>
                ) : null}
                <h3>{item.name}</h3>
                <PlanPrice
                  item={item}
                  period={item.kind === "TEAM" ? t("landingPricingSeat") : t("landingPricingMonth")}
                  untilLabel={t("landingPricingPromoUntil")}
                />
              </div>
              <PlanCta
                item={item}
                columns={columns}
                currentSlug={currentSlug}
                rodiumSub={rodiumSub}
                countryIso={countryIso}
                subscribeLabel={t("landingPricingCta")}
                freeLabel={t("landingPricingFreeCta")}
                currentLabel={t("landingPricingCurrent")}
                onTeam={setTeamOffer}
              />
            </div>
            <div className="lp-plan-features">
              {rows.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <span>{renderCompareCell(row.value(item), compareLabels)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      </>
      )}

      <div className="lp-or" role="separator">
        <span>{t("landingOr")}</span>
      </div>
      <div className="lp-alt">
        <h3>{t("landingAltTitle")}</h3>
        <div className="lp-alt-grid">
          {/* The "Connect your RodiumAi account" card was removed: signing in
              with Google or email already links (or creates) the RodiumAi
              account automatically, so this option was redundant and confusing
              for non-technical users. BYOK stays for self-hosting. */}
          <article className="lp-alt-card">
            <h4>{t("landingAltByokTitle")}</h4>
            <p>{t("landingAltByokBody")}</p>
            <ul>
              <li>{t("landingAltLimitProjects")}</li>
              <li>{t("landingAltLimitDomain")}</li>
              <li>{t("landingAltLimitExport")}</li>
            </ul>
            <a className="lp-compare-cta" href="/settings?tab=generation">
              {t("landingAltCtaByok")}
            </a>
          </article>
        </div>
      </div>
      {teamOffer ? (
        <TeamSeatDialog
          plan={teamOffer}
          countryIso={countryIso}
          rodiumSub={rodiumSub}
          onClose={() => setTeamOffer(null)}
        />
      ) : null}
    </section>
  );
}

type Cell = { kind: "yes" | "no" } | { kind: "text"; text: string };

type CompareStored = {
  id: string;
  label?: string;
  labelFr?: string;
  visible?: boolean;
  sort?: number;
  kind?: "yes" | "no" | "text";
  text?: string;
  textFr?: string;
};

function readCompare(entitlements: Entitlements): CompareStored[] | null {
  const raw = (entitlements as Entitlements & { compare?: unknown }).compare;
  if (!Array.isArray(raw)) return null;
  const rows = raw.filter(
    (row): row is CompareStored =>
      Boolean(row) && typeof row === "object" && typeof (row as CompareStored).id === "string",
  );
  return rows.length ? rows : null;
}

function buildCompareRows(
  columns: ApiPlan[],
  locale: string,
  t: (key: "landingCompareFrodi" | "landingCompareProjects" | "landingCompareSeats" | "landingCompareSeatsMin" | "landingCompareModel" | "landingCompareDomain" | "landingCompareExport" | "landingCompareHistory" | "landingComparePriority" | "landingCompareWeek" | "landingCompareMonth" | "landingCompareLimited" | "landingPricingUnlimited" | "landingPricingChoose" | "landingPricingAuto") => string,
): Array<{ label: string; value: (item: ApiPlan) => Cell }> {
  const dynamic = columns.some((item) => readCompare(item.entitlements));
  if (!dynamic) return fallbackCompareRows(t);

  const defs = new Map<string, CompareStored>();
  for (const item of columns) {
    for (const row of readCompare(item.entitlements) ?? []) {
      const prev = defs.get(row.id);
      if (!prev || (row.sort ?? 0) < (prev.sort ?? 0)) defs.set(row.id, row);
    }
  }
  return [...defs.values()]
    .filter((row) => row.visible !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((def) => ({
      label: locale === "fr" ? def.labelFr || def.label || def.id : def.label || def.labelFr || def.id,
      value: (item) => {
        const cell = (readCompare(item.entitlements) ?? []).find((row) => row.id === def.id);
        if (!cell || cell.kind === "no" || !cell.kind) return { kind: "no" as const };
        if (cell.kind === "yes") return { kind: "yes" as const };
        const text =
          locale === "fr" ? cell.textFr || cell.text || "" : cell.text || cell.textFr || "";
        return { kind: "text" as const, text: text || "—" };
      },
    }));
}

function fallbackCompareRows(
  t: (key: "landingCompareFrodi" | "landingCompareProjects" | "landingCompareSeats" | "landingCompareSeatsMin" | "landingCompareModel" | "landingCompareDomain" | "landingCompareExport" | "landingCompareHistory" | "landingComparePriority" | "landingCompareWeek" | "landingCompareMonth" | "landingCompareLimited" | "landingPricingUnlimited" | "landingPricingChoose" | "landingPricingAuto") => string,
): Array<{ label: string; value: (item: ApiPlan) => Cell }> {
  return [
    {
      label: t("landingCompareFrodi"),
      value: (item) => ({
        kind: "text",
        text: `${item.frodiPerCycle.toLocaleString("fr-FR")} / ${
          item.cycle === "WEEKLY" ? t("landingCompareWeek") : t("landingCompareMonth")
        }`,
      }),
    },
    {
      label: t("landingCompareProjects"),
      value: (item) => ({
        kind: "text",
        text:
          item.entitlements.max_projects == null
            ? t("landingPricingUnlimited")
            : String(item.entitlements.max_projects),
      }),
    },
    {
      label: t("landingCompareSeats"),
      value: (item) => ({
        kind: "text",
        text:
          item.kind === "TEAM"
            ? t("landingCompareSeatsMin").replace("{n}", String(item.minSeats ?? 5))
            : "1",
      }),
    },
    {
      label: t("landingCompareModel"),
      value: (item) =>
        item.entitlements.model_selection
          ? { kind: "text", text: t("landingPricingChoose") }
          : { kind: "text", text: t("landingPricingAuto") },
    },
    {
      label: t("landingCompareDomain"),
      value: (item) => ({ kind: item.entitlements.custom_domain ? "yes" : "no" }),
    },
    {
      label: t("landingCompareExport"),
      value: (item) => ({ kind: item.entitlements.export ? "yes" : "no" }),
    },
    {
      label: t("landingCompareHistory"),
      value: (item) =>
        item.entitlements.history === "limited" || item.slug === "free"
          ? { kind: "text", text: t("landingCompareLimited") }
          : { kind: "yes" },
    },
    {
      label: t("landingComparePriority"),
      value: (item) => ({
        kind:
          item.entitlements.priority_generation ||
          ["pro", "scale", "team-pro"].includes(item.slug)
            ? "yes"
            : "no",
      }),
    },
  ];
}

function renderCompareCell(cell: Cell, labels: { yes: string; no: string }) {
  if (cell.kind === "yes") {
    return (
      <span className="lp-mark is-yes" aria-label={labels.yes}>
        ✓
      </span>
    );
  }
  if (cell.kind === "no") {
    return (
      <span className="lp-mark is-no" aria-label={labels.no}>
        —
      </span>
    );
  }
  return cell.text;
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  builder: 2,
  pro: 3,
  scale: 4,
  "team-pro": 10,
  // Legacy slug kept for ranking if a subscriber still holds it.
  "team-scale": 11,
};

function planRank(item: ApiPlan): number {
  return typeof item.sortOrder === "number" ? item.sortOrder : (PLAN_RANK[item.slug] ?? 0);
}

function planRelation(
  item: ApiPlan,
  columns: ApiPlan[],
  currentSlug: string | null,
): "open" | "current" | "past" {
  if (!currentSlug) return "open";
  const current = columns.find((column) => column.slug === currentSlug);
  if (!current) return "open";
  if (item.slug === current.slug) return "current";
  return planRank(item) < planRank(current) ? "past" : "open";
}

function PlanCta({
  item,
  columns,
  currentSlug,
  rodiumSub,
  countryIso,
  subscribeLabel,
  freeLabel,
  currentLabel,
  onTeam,
}: {
  item: ApiPlan;
  columns: ApiPlan[];
  currentSlug: string | null;
  rodiumSub: string | null;
  countryIso: string;
  subscribeLabel: string;
  freeLabel: string;
  currentLabel: string;
  onTeam: (item: ApiPlan) => void;
}) {
  const relation = planRelation(item, columns, currentSlug);
  if (relation === "current") {
    return <span className="lp-compare-cta is-current">{currentLabel}</span>;
  }
  if (relation === "past") {
    return (
      <span className="lp-compare-cta is-unavailable" aria-disabled="true">
        —
      </span>
    );
  }
  if (item.kind === "TEAM") {
    return (
      <button type="button" className="lp-compare-cta" onClick={() => onTeam(item)}>
        {subscribeLabel}
      </button>
    );
  }
  return (
    <a className="lp-compare-cta" href={planCheckoutHref(item, rodiumSub, countryIso)}>
      {item.slug === "free" ? freeLabel : subscribeLabel}
    </a>
  );
}

function TeamSeatDialog({
  plan,
  countryIso,
  rodiumSub,
  onClose,
}: {
  plan: ApiPlan;
  countryIso: string;
  rodiumSub: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const min = plan.minSeats && plan.minSeats > 0 ? plan.minSeats : 5;
  const mine = getSessionSnapshot()?.profile?.email?.trim() || "";
  const [count, setCount] = useState(min);
  const [emails, setEmails] = useState<string[]>(() =>
    Array.from({ length: min }, (_, index) => (index === 0 ? mine : "")),
  );

  function setSeatCount(next: number) {
    const safe = Math.max(min, next);
    setCount(safe);
    setEmails((prev) => {
      const copy = prev.slice(0, safe);
      while (copy.length < safe) copy.push("");
      if (mine) copy[0] = mine;
      return copy;
    });
  }

  const empty = Math.max(0, count - emails.filter((email) => email.trim()).length);

  function continueToPay() {
    const invites = emails.map((email) => email.trim()).filter(Boolean);
    try {
      localStorage.setItem(
        "forge.teamSetup",
        JSON.stringify({ plan: plan.slug, seats: count, emails: invites }),
      );
    } catch {
      /* private mode */
    }
    const href = !getToken() || !rodiumSub
      ? `/login?next=${encodeURIComponent(
          forgeSubscribeReturnPath({
            plan: plan.slug,
            currency: plan.currency,
            country: countryIso,
            seats: count,
          }),
        )}`
      : forgeSubscriptionPayUrl({
          uid: rodiumSub,
          plan: plan.slug,
          currency: plan.currency,
          country: countryIso,
          seats: count,
        });
    window.location.assign(href);
  }

  return (
    <div className="lp-team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-seats-title">
      <button type="button" className="lp-team-dialog-backdrop" aria-label={t("close")} onClick={onClose} />
      <form
        className="lp-team-dialog-card"
        onSubmit={(event) => {
          event.preventDefault();
          continueToPay();
        }}
      >
        <h3 id="team-seats-title">{t("teamSeatsTitle")}</h3>
        <p>{t("teamSeatsHelp")}</p>
        <label>
          {t("teamSeatsCount")}
          <input
            type="number"
            min={min}
            value={count}
            onChange={(event) => setSeatCount(Number(event.target.value))}
          />
        </label>
        <div className="lp-team-emails">
          {emails.map((email, index) => (
            <label key={index}>
              {index === 0 ? t("teamSeatYou") : t("teamSeatEmail").replace("{n}", String(index + 1))}
              <input
                type="email"
                value={email}
                readOnly={index === 0}
                placeholder="email@exemple.com"
                onChange={(event) =>
                  setEmails((prev) => prev.map((value, i) => (i === index ? event.target.value : value)))
                }
              />
            </label>
          ))}
        </div>
        <p>{t("teamSeatEmpty").replace("{n}", String(empty))}</p>
        <button type="submit" className="lp-compare-cta">
          {t("teamSeatContinue")}
        </button>
      </form>
    </div>
  );
}

function planCheckoutHref(
  item: ApiPlan,
  rodiumSub: string | null,
  countryIso: string,
): string {
  if (item.slug === "free") return getToken() ? "/dashboard" : "/register";
  const seats = item.kind === "TEAM" ? 5 : null;
  if (!getToken() || !rodiumSub) {
    return `/login?next=${encodeURIComponent(
      forgeSubscribeReturnPath({
        plan: item.slug,
        currency: item.currency,
        country: countryIso,
        seats,
      }),
    )}`;
  }
  return forgeSubscriptionPayUrl({
    uid: rodiumSub,
    plan: item.slug,
    currency: item.currency,
    country: countryIso,
    seats,
  });
}
