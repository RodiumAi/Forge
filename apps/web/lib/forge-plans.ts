"use client";

/**
 * Forge plans and the account's payment country, for the billing page.
 *
 * Plans come from `/api/forge-plans?currency=` (proxy of Nest
 * `/public/forge/plans`): monthly price in that currency, FRODI per cycle
 * (WEEKLY, MONTHLY on Free) and the comparison rows of each plan. The payment
 * country is the account's (`profile.payment_country_iso`), else the one this
 * browser remembers (same key as the landing pricing), else Togo.
 */

import { useCallback, useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";
import { usePaymentCountries, type PaymentCountry } from "@/lib/payment-countries";
import { ensureSession, getSessionSnapshot, patchSessionCache } from "@/lib/session-cache";

export type PlanCompareRow = {
  id: string;
  kind?: "yes" | "no" | "text";
  sort?: number;
  text?: string;
  textFr?: string;
  label?: string;
  labelFr?: string;
  visible?: boolean;
  surface?: string;
  forgeOnly?: boolean | null;
};

export type ForgePlan = {
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
  maxProjects?: number | null;
  entitlements: {
    max_projects?: number | null;
    model_selection?: boolean;
    custom_domain?: boolean;
    export?: boolean;
    history?: boolean | "limited";
    priority_generation?: boolean;
    compare?: PlanCompareRow[];
  };
};

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, builder: 2, pro: 3, scale: 4, "team-pro": 10, "team-scale": 11 };

export function planRank(plan: Pick<ForgePlan, "slug" | "sortOrder">): number {
  return typeof plan.sortOrder === "number" ? plan.sortOrder : (PLAN_RANK[plan.slug] ?? 0);
}

/** Current, below the current plan (not offered), or open. */
export function planRelation(plan: ForgePlan, plans: ForgePlan[], current: string | null): "current" | "past" | "open" {
  if (!current) return "open";
  const mine = plans.find((p) => p.slug === current);
  if (!mine) return "open";
  if (plan.slug === mine.slug) return "current";
  return planRank(plan) < planRank(mine) ? "past" : "open";
}

const planCache = new Map<string, ForgePlan[]>();

export function useForgePlans(currency: string): { plans: ForgePlan[] | null; error: boolean } {
  const [plans, setPlans] = useState<ForgePlan[] | null>(() => planCache.get(currency) ?? null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setPlans(planCache.get(currency) ?? null);
    setError(false);
    fetch(`/api/forge-plans?currency=${encodeURIComponent(currency)}`)
      .then((res) => res.json())
      .then((body: { plans?: ForgePlan[] }) => {
        if (!alive) return;
        const list = Array.isArray(body?.plans) ? [...body.plans].sort((a, b) => planRank(a) - planRank(b)) : [];
        if (list.length) planCache.set(currency, list);
        setPlans(list);
        setError(!list.length);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [currency]);
  return { plans, error };
}

export const PRICING_COUNTRY_KEY = "forge.pricingCountry";
const DEFAULT_COUNTRY = "TG";

function storedCountry(): string | null {
  try {
    const value = localStorage.getItem(PRICING_COUNTRY_KEY)?.trim().toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** The payment country (account first), its currency, and a setter that saves it on the account. */
export function usePaymentCountry(): {
  iso: string;
  country: PaymentCountry | null;
  currency: string;
  countries: PaymentCountry[];
  setCountry: (iso: string) => void;
} {
  const { countries } = usePaymentCountries();
  const [iso, setIso] = useState(DEFAULT_COUNTRY);

  useEffect(() => {
    const local = storedCountry();
    if (local) setIso(local);
    if (!getToken()) return;
    void ensureSession().then(() => {
      const account = getSessionSnapshot()?.profile?.payment_country_iso?.toUpperCase();
      if (account && /^[A-Z]{2}$/.test(account)) setIso(account);
    });
  }, []);

  const setCountry = useCallback((next: string) => {
    setIso(next);
    try {
      localStorage.setItem(PRICING_COUNTRY_KEY, next);
    } catch {
      /* private mode */
    }
    if (!getToken()) return;
    void api("/settings/payment-country", { method: "PATCH", body: JSON.stringify({ iso2: next }) })
      .then(() => {
        const prev = getSessionSnapshot()?.profile;
        if (prev) patchSessionCache({ profile: { ...prev, payment_country_iso: next } });
      })
      .catch(() => undefined);
  }, []);

  const country = countries.find((c) => c.iso2 === iso) ?? null;
  return { iso, country, currency: country?.currencyCode ?? "XOF", countries, setCountry };
}
