"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PricingCountry = {
  iso2: string;
  name: string;
  currencyCode: string;
};

function flagSrc(iso2: string) {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

export function CountryCurrencySelect({
  countries,
  value,
  onChange,
  label,
  searchPlaceholder,
  emptyLabel,
}: {
  countries: PricingCountry[];
  value: string;
  onChange: (iso2: string) => void;
  label: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = countries.find((country) => country.iso2 === value) ?? countries[0];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (!needle) return sorted;
    return sorted.filter((country) =>
      `${country.name} ${country.iso2} ${country.currencyCode}`.toLowerCase().includes(needle),
    );
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <div className="lp-country" ref={rootRef}>
      <button
        type="button"
        className="lp-country-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <Flag iso2={selected.iso2} />
        <span className="lp-country-name">{selected.name}</span>
        <span className="lp-country-code">({selected.currencyCode})</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="lp-country-panel" role="listbox" aria-label={label}>
          <input
            ref={searchRef}
            className="lp-country-search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul>
            {filtered.length === 0 ? (
              <li className="lp-country-empty">{emptyLabel}</li>
            ) : (
              filtered.map((country) => {
                const active = country.iso2 === selected.iso2;
                return (
                  <li key={country.iso2}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={active ? "is-active" : undefined}
                      onClick={() => {
                        onChange(country.iso2);
                        setOpen(false);
                      }}
                    >
                      <Flag iso2={country.iso2} />
                      <span className="lp-country-name">{country.name}</span>
                      <span className="lp-country-code">({country.currencyCode})</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Flag({ iso2 }: { iso2: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const emoji = iso2
      .toUpperCase()
      .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
    return (
      <span className="lp-country-flag lp-country-flag-emoji" aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <img
      className="lp-country-flag"
      src={flagSrc(iso2)}
      alt=""
      width={22}
      height={16}
      onError={() => setFailed(true)}
    />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`lp-country-chevron${open ? " is-open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
    >
      <path
        d="M3.5 5.25 7 8.75l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
