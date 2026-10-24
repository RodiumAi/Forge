"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { countryName, usePaymentCountries, type PaymentCountry } from "@/lib/payment-countries";

import { IconButton } from "./Button";
import { cx } from "./cx";
import { Flag } from "./Flag";
import { Glyph } from "./glyph";
import { useDismiss } from "./use-dismiss";

type CountryPickerProps = {
  /** Selected ISO 3166 alpha-2 code. */
  value: string;
  onChange: (iso2: string, country: PaymentCountry) => void;
  /** Countries to offer; defaults to the payment countries API. */
  countries?: PaymentCountry[];
  /** Panel alignment under the trigger (desktop). */
  align?: "center" | "start" | "end";
  className?: string;
};

/**
 * Country and currency picker with flags, fed by the payment countries API.
 * Searchable combobox (arrows, Home, End, Enter, Escape); a bottom sheet under 640px.
 * It only reports the choice: storing it (localStorage, PATCH
 * /settings/payment-country) stays with the page.
 */
export function CountryPicker({ value, onChange, countries: given, align = "center", className }: CountryPickerProps) {
  const { t, locale } = useI18n();
  const api = usePaymentCountries();
  const countries = given ?? api.countries;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sorted = useMemo(
    () =>
      countries
        .map((c) => ({ ...c, label: countryName(c, locale) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [countries, locale],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((c) => `${c.label} ${c.name} ${c.iso2} ${c.currencyCode}`.toLowerCase().includes(needle));
  }, [sorted, query]);
  const selected = sorted.find((c) => c.iso2 === value.toUpperCase()) ?? sorted[0];

  function toggle(next: boolean, refocus = false) {
    setOpen(next);
    setQuery("");
    setActive(Math.max(0, sorted.findIndex((c) => c.iso2 === selected?.iso2)));
    if (!next && refocus) triggerRef.current?.focus();
  }
  useDismiss(open, () => toggle(false), [rootRef], triggerRef);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const phone = window.matchMedia?.("(max-width: 640px)").matches;
    if (phone) document.body.classList.add("f-lock");
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("f-lock");
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(".is-active")?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function choose(country: PaymentCountry) {
    onChange(country.iso2, country);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    const n = filtered.length;
    if (event.key === "ArrowDown" && n) {
      event.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (event.key === "ArrowUp" && n) {
      event.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, n - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  if (!selected) return null;
  const listId = `${id}-list`;
  const activeRow = filtered[Math.min(active, filtered.length - 1)];
  const methods = (n: number | undefined) =>
    n == null ? "" : (n > 1 ? t("uiCountryMethods") : t("uiCountryMethod")).replace("{n}", String(n));

  return (
    <div className={cx("f-cpick", className)} ref={rootRef} data-align={align}>
      <button
        ref={triggerRef}
        type="button"
        className="f-cpick-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t("uiCountryLabel")}: ${selected.label}, ${selected.currencyCode}`}
        onClick={() => toggle(!open)}
      >
        <Flag iso2={selected.iso2} />
        <span className="f-cpick-name">{selected.label}</span>
        <span className="f-cpick-cur">{selected.currencyCode}</span>
        <Glyph name="chevron-down" size="sm" />
      </button>
      {open ? (
        <>
          <div className="f-cpick-panel" role="dialog" aria-label={t("uiCountryTitle")}>
            <div className="f-cpick-sheet-head">
              <b>{t("uiCountryTitle")}</b>
              <IconButton icon="x" size="sm" label={t("uiClose")} onClick={() => toggle(false, true)} />
            </div>
            <label className="f-cpick-search">
              <Glyph name="search" size="sm" />
              <span className="f-sr-only">{t("uiCountrySearch")}</span>
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeRow ? `${id}-${activeRow.iso2}` : undefined}
                placeholder={t("uiCountrySearch")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
              />
            </label>
            <ul className="f-cpick-list" role="listbox" id={listId} ref={listRef} aria-label={t("uiCountryTitle")}>
              {filtered.length === 0 ? (
                <li className="f-cpick-empty" role="presentation">
                  {t("uiCountryEmpty")}
                </li>
              ) : (
                filtered.map((c, i) => (
                  <li
                    key={c.iso2}
                    id={`${id}-${c.iso2}`}
                    role="option"
                    aria-selected={c.iso2 === selected.iso2}
                    className={i === active ? "is-active" : undefined}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => choose(c)}
                  >
                    <Flag iso2={c.iso2} width={26} />
                    <span className="f-cpick-cn">
                      {c.label}
                      {c.methodsCount != null ? <small>{methods(c.methodsCount)}</small> : null}
                    </span>
                    <span className="f-cpick-cc">{c.currencyCode}</span>
                    {c.iso2 === selected.iso2 ? <Glyph name="check" size="sm" /> : <span style={{ width: 16 }} />}
                  </li>
                ))
              )}
            </ul>
            <p className="f-cpick-foot">
              <Glyph name="phone" size="sm" />
              {t("uiCountryFoot")}
            </p>
          </div>
          <button type="button" className="f-cpick-scrim" tabIndex={-1} aria-hidden onClick={() => toggle(false, true)} />
        </>
      ) : null}
    </div>
  );
}
