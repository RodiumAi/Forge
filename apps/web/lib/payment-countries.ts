"use client";

/**
 * Payment countries from `/api/payment-countries` (proxy of Nest
 * `/public/payment-countries`): ISO code, English name, currency and the number
 * of payment methods. One fetch per page load, shared by every picker.
 */

import { useEffect, useState } from "react";

export type PaymentCountry = {
  iso2: string;
  /** English name from the API; display with `countryName()` for the locale. */
  name: string;
  currencyCode: string;
  methodsCount?: number;
  paymentMode?: string;
};

/** Shown while the API answers, or if it fails (same list as the landing pricing). */
export const FALLBACK_PAYMENT_COUNTRIES: PaymentCountry[] = [
  { iso2: "TG", name: "Togo", currencyCode: "XOF" },
  { iso2: "BJ", name: "Benin", currencyCode: "XOF" },
  { iso2: "CI", name: "Côte d'Ivoire", currencyCode: "XOF" },
  { iso2: "SN", name: "Senegal", currencyCode: "XOF" },
  { iso2: "CM", name: "Cameroon", currencyCode: "XAF" },
  { iso2: "GH", name: "Ghana", currencyCode: "GHS" },
  { iso2: "NG", name: "Nigeria", currencyCode: "NGN" },
  { iso2: "KE", name: "Kenya", currencyCode: "KES" },
];

let cache: PaymentCountry[] | null = null;
let flight: Promise<PaymentCountry[]> | null = null;

function isCountry(row: unknown): row is PaymentCountry {
  const r = row as PaymentCountry | null;
  return Boolean(r && typeof r.iso2 === "string" && typeof r.name === "string" && typeof r.currencyCode === "string");
}

export function loadPaymentCountries(): Promise<PaymentCountry[]> {
  if (cache) return Promise.resolve(cache);
  if (!flight) {
    flight = fetch("/api/payment-countries")
      .then((res) => (res.ok ? res.json() : []))
      .then((body: unknown) => {
        const list = Array.isArray(body) ? body.filter(isCountry) : [];
        cache = list.length ? list : FALLBACK_PAYMENT_COUNTRIES;
        return cache;
      })
      .catch(() => FALLBACK_PAYMENT_COUNTRIES)
      .finally(() => {
        flight = null;
      });
  }
  return flight;
}

/** The countries, with `loading` until the API answered (the fallback list meanwhile). */
export function usePaymentCountries(): { countries: PaymentCountry[]; loading: boolean } {
  const [countries, setCountries] = useState<PaymentCountry[]>(() => cache ?? FALLBACK_PAYMENT_COUNTRIES);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    let alive = true;
    void loadPaymentCountries().then((list) => {
      if (!alive) return;
      setCountries(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { countries, loading };
}

const displayNames = new Map<string, Intl.DisplayNames | null>();

/** Country name in the UI locale ("Bénin" in French), the API name as fallback. */
export function countryName(country: Pick<PaymentCountry, "iso2" | "name">, locale: string): string {
  let names = displayNames.get(locale);
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      names = null;
    }
    displayNames.set(locale, names);
  }
  try {
    return names?.of(country.iso2.toUpperCase()) || country.name;
  } catch {
    return country.name;
  }
}
