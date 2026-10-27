"use client";

/**
 * Forge plans for the pricing cards: the payment country (account, then the
 * stored choice, then the visitor's geo country), the plans of its currency
 * from `/api/forge-plans` (proxy of Nest `/public/forge/plans`), the
 * comparison rows the admin writes on each plan and the checkout links.
 *
 * Prices are monthly (`priceConverted`, `priceFcfaMonthly`); a plan's `cycle`
 * is only how often its FRODI allowance renews.
 */

import { useCallback, useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";
import { rowSurface, type BenefitSurface } from "@/lib/compare-surface";
import { forgeSubscribeReturnPath, forgeSubscriptionPayUrl } from "@/lib/constants/rodium-links";
import { loadPaymentCountries, FALLBACK_PAYMENT_COUNTRIES, type PaymentCountry } from "@/lib/payment-countries";
import { ensureSession, getSessionSnapshot } from "@/lib/session-cache";

export type PlanEntitlements = {
  max_projects?: number | null;
  model_selection?: boolean;
  custom_domain?: boolean;
  export?: boolean;
  history?: boolean | "limited";
  priority_generation?: boolean;
  compare?: unknown;
};

export type ForgePlan = {
  slug: string;
  name: string;
  priceConverted: number;
  priceFcfaMonthly?: number;
  listPrice?: number;
  promoEndsAt?: string | null;
  promoName?: string | null;
  currency: string;
  frodiPerCycle: number;
  cycle: string;
  kind: string;
  minSeats: number | null;
  maxProjects?: number | null;
  sortOrder?: number;
  entitlements: PlanEntitlements;
};

export type PlansPayload = { currency: string; fallback?: boolean; plans: ForgePlan[] };

export const PLAN_ORDER = ["free", "starter", "builder", "pro", "scale", "team-pro"] as const;

export const DEFAULT_COUNTRY = "TG";
const COUNTRY_KEY = "forge.pricingCountry";
const CATALOGUE_KEY = "forge.pricingCatalogue.v2";

/** Currency signs the cards show; others show the ISO code. */
const CURRENCY_SIGN: Record<string, string> = {
  XOF: "F CFA",
  XAF: "F CFA",
  GHS: "GH₵",
  NGN: "₦",
  KES: "KSh",
  CDF: "FC",
  RWF: "FRw",
  UGX: "USh",
  SLE: "Le",
  ZMW: "K",
  TZS: "TSh",
};

export function currencySign(code: string): string {
  return CURRENCY_SIGN[code] ?? code;
}

export function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 0 }).format(amount);
}

function isPlan(value: unknown): value is ForgePlan {
  const p = value as ForgePlan | null;
  return Boolean(
    p && typeof p.slug === "string" && typeof p.name === "string" && typeof p.priceConverted === "number" &&
      typeof p.currency === "string" && p.entitlements && typeof p.entitlements === "object",
  );
}

function readCatalogue(): Record<string, PlansPayload> {
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOGUE_KEY) || "{}") as Record<string, PlansPayload>;
    const out: Record<string, PlansPayload> = {};
    for (const [code, payload] of Object.entries(raw)) {
      if (payload && Array.isArray(payload.plans) && payload.plans.length && payload.plans.every(isPlan)) out[code] = payload;
    }
    return out;
  } catch {
    return {};
  }
}

function rememberPlans(currency: string, payload: PlansPayload) {
  try {
    const all = readCatalogue();
    all[currency] = payload;
    localStorage.setItem(CATALOGUE_KEY, JSON.stringify(all));
  } catch {
    /* private mode or quota */
  }
}

export function readStoredCountry(): string | null {
  try {
    const value = localStorage.getItem(COUNTRY_KEY)?.trim().toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredCountry(iso: string) {
  try {
    localStorage.setItem(COUNTRY_KEY, iso);
  } catch {
    /* private mode */
  }
}

/**
 * The payment country and the list it comes from. Order: the account's saved
 * country, the choice stored in this browser, the visitor's geo country, Togo.
 * `select` stores the choice and, when signed in, saves it on the account.
 */
export function usePricingCountry(): {
  country: PaymentCountry;
  countries: PaymentCountry[];
  ready: boolean;
  select: (iso: string) => void;
} {
  const [countries, setCountries] = useState<PaymentCountry[]>(FALLBACK_PAYMENT_COUNTRIES);
  const [iso, setIso] = useState(DEFAULT_COUNTRY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredCountry();
    if (stored) setIso(stored);
    void (async () => {
      try {
        const [list, geo] = await Promise.all([
          loadPaymentCountries(),
          fetch("/api/visitor-country")
            .then((res) => res.json() as Promise<{ iso2?: string }>)
            .catch(() => ({}) as { iso2?: string }),
        ]);
        if (cancelled) return;
        setCountries(list);
        const known = (code: string | null | undefined) =>
          list.find((c) => c.iso2 === (code ?? "").toUpperCase())?.iso2 ?? null;
        let account: string | null = null;
        if (getToken()) {
          await ensureSession().catch(() => undefined);
          account = known(getSessionSnapshot()?.profile?.payment_country_iso);
        }
        if (cancelled) return;
        const chosen = account ?? known(stored) ?? known(geo.iso2) ?? known(DEFAULT_COUNTRY) ?? list[0]?.iso2 ?? DEFAULT_COUNTRY;
        setIso(chosen);
        if (account) writeStoredCountry(account);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback((next: string) => {
    setIso(next);
    writeStoredCountry(next);
    if (!getToken()) return;
    void api("/settings/payment-country", { method: "PATCH", body: JSON.stringify({ iso2: next }) }).catch(() => undefined);
  }, []);

  const country =
    countries.find((c) => c.iso2 === iso) ??
    FALLBACK_PAYMENT_COUNTRIES.find((c) => c.iso2 === iso) ?? { iso2: iso, name: iso, currencyCode: "XOF" };
  return { country, countries, ready, select };
}

/** The plans in `currency`, ordered Free to Team Pro; cached per currency for an instant paint. */
export function useForgePlans(currency: string, enabled = true): {
  payload: PlansPayload | null;
  error: boolean;
} {
  const [payload, setPayload] = useState<PlansPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = readCatalogue()[currency] ?? null;
    setPayload(cached);
    setError(false);
    if (!enabled) return;
    let cancelled = false;
    void fetch(`/api/forge-plans?currency=${encodeURIComponent(currency)}`)
      .then((res) => res.json() as Promise<Partial<PlansPayload>>)
      .then((body) => {
        if (cancelled) return;
        const plans = Array.isArray(body.plans) ? body.plans.filter(isPlan) : [];
        if (!plans.length) {
          if (!cached) setError(true);
          return;
        }
        const next: PlansPayload = { currency: body.currency || currency, fallback: Boolean(body.fallback), plans };
        rememberPlans(currency, next);
        setPayload(next);
      })
      .catch(() => {
        if (!cancelled && !cached) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, enabled]);

  return { payload, error };
}

export function orderedPlans(plans: ForgePlan[]): ForgePlan[] {
  const bySlug = new Map(plans.map((p) => [p.slug, p]));
  return PLAN_ORDER.map((slug) => bySlug.get(slug)).filter((p): p is ForgePlan => Boolean(p));
}

/* ------------------------------------------------------------ comparison rows */

export type CompareCell = { kind: "yes" } | { kind: "no" } | { kind: "text"; text: string };

export type CompareRow = {
  id: string;
  label: string;
  surface: BenefitSurface;
  value: (plan: ForgePlan) => CompareCell;
};

type StoredRow = {
  id: string;
  label?: string;
  labelFr?: string;
  visible?: boolean;
  surface?: unknown;
  forgeOnly?: boolean;
  sort?: number;
  kind?: "yes" | "no" | "text";
  text?: string;
  textFr?: string;
};

function storedRows(plan: ForgePlan): StoredRow[] {
  const raw = plan.entitlements.compare;
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is StoredRow => Boolean(row) && typeof (row as StoredRow).id === "string");
}

/**
 * The comparison rows the admin wrote on the plans (`entitlements.compare`),
 * sorted, visible ones only, Code-only rows left out (this is the Forge
 * pricing). Each row keeps its surface so the page can tag "Forge + Code".
 */
export function compareRows(plans: ForgePlan[], locale: string): CompareRow[] {
  const defs = new Map<string, StoredRow>();
  for (const plan of plans) {
    for (const row of storedRows(plan)) {
      const prev = defs.get(row.id);
      if (!prev || (row.sort ?? 0) < (prev.sort ?? 0)) defs.set(row.id, row);
    }
  }
  const fr = locale === "fr";
  return [...defs.values()]
    .filter((row) => row.visible !== false)
    .map((row) => ({ row, surface: rowSurface(row.id, row) }))
    .filter(({ surface }) => surface !== "code")
    .sort((a, b) => (a.row.sort ?? 0) - (b.row.sort ?? 0))
    .map(({ row, surface }) => ({
      id: row.id,
      surface,
      label: fr ? row.labelFr || row.label || row.id : row.label || row.labelFr || row.id,
      value: (plan: ForgePlan): CompareCell => {
        const cell = storedRows(plan).find((r) => r.id === row.id);
        if (!cell || !cell.kind || cell.kind === "no") return { kind: "no" };
        if (cell.kind === "yes") return { kind: "yes" };
        const text = fr ? cell.textFr || cell.text || "" : cell.text || cell.textFr || "";
        return text ? { kind: "text", text } : { kind: "no" };
      },
    }));
}

/* ------------------------------------------------------------ plan relation and checkout */

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, builder: 2, pro: 3, scale: 4, "team-pro": 10, "team-scale": 11 };

function planRank(plan: ForgePlan): number {
  return typeof plan.sortOrder === "number" ? plan.sortOrder : (PLAN_RANK[plan.slug] ?? 0);
}

/** Where a plan sits against the account's current one. */
export function planRelation(plan: ForgePlan, plans: ForgePlan[], currentSlug: string | null): "open" | "current" | "past" {
  if (!currentSlug) return "open";
  const current = plans.find((p) => p.slug === currentSlug);
  if (!current) return "open";
  if (plan.slug === current.slug) return "current";
  return planRank(plan) < planRank(current) ? "past" : "open";
}

/** Free goes to sign-up (or the dashboard); paid plans go to the RodiumAi pay page, through sign-in when needed. */
export function planCheckoutHref(plan: ForgePlan, rodiumSub: string | null, countryIso: string, seats: number | null = null): string {
  if (plan.slug === "free") return getToken() ? "/dashboard" : "/register";
  const count = plan.kind === "TEAM" ? (seats ?? plan.minSeats ?? 5) : null;
  if (!getToken() || !rodiumSub) {
    return `/login?next=${encodeURIComponent(
      forgeSubscribeReturnPath({ plan: plan.slug, currency: plan.currency, country: countryIso, seats: count }),
    )}`;
  }
  return forgeSubscriptionPayUrl({ uid: rodiumSub, plan: plan.slug, currency: plan.currency, country: countryIso, seats: count });
}
