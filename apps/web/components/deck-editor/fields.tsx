"use client";

/**
 * Small form controls of the properties panel: numbers that commit on blur
 * or Enter, theme color swatches, selects and toggles.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import type { ThemeTokens } from "@/components/deck-player";
import type { DeckT } from "./strings";

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const NON_COLOR = /^--(font|radius|space|spacing|shadow|duration|ease|size|line|letter|weight|z)/;

/** Theme tokens that hold a color, in a stable order (the common roles first). */
export function colorTokens(tokens: ThemeTokens): { name: string; value: string }[] {
  const first = ["--bg", "--fg", "--accent", "--muted", "--surface", "--border"];
  const entries = Object.entries(tokens).filter(
    ([name, value]) => name.startsWith("--") && !NON_COLOR.test(name) && /^(#|rgb|hsl|oklch|var\(|[a-z]+$)/i.test(value.trim()),
  );
  entries.sort(([a], [b]) => {
    const ia = first.indexOf(a);
    const ib = first.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
  return entries.slice(0, 24).map(([name, value]) => ({ name, value }));
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="de-field">
      <span className="de-field-label">{label}</span>
      {children}
      {hint ? <span className="de-field-hint">{hint}</span> : null}
    </label>
  );
}

/** Number input: typing does not commit each keystroke, blur and Enter do. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(round(value)));
  useEffect(() => setDraft(value === undefined ? "" : String(round(value))), [value]);
  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || draft.trim() === "") {
      setDraft(value === undefined ? "" : String(round(value)));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== value) onChange(clamped);
    setDraft(String(round(clamped)));
  };
  return (
    <label className="de-field de-field-number">
      <span className="de-field-label">{label}</span>
      <span className="de-number">
        <input
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        {suffix ? <span className="de-number-suffix">{suffix}</span> : null}
      </span>
    </label>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | "";
  options: { value: T | ""; label: string }[];
  onChange: (value: T | "") => void;
  disabled?: boolean;
}) {
  return (
    <label className="de-field">
      <span className="de-field-label">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T | "")}>
        {options.map((o) => (
          <option key={o.value || "_none"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  return (
    <label className="de-field">
      <span className="de-field-label">{label}</span>
      {multiline ? (
        <textarea value={draft} placeholder={placeholder} maxLength={maxLength} rows={5} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
      ) : (
        <input
          value={draft}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      )}
      {hint ? <span className="de-field-hint">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="de-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Theme color picker: swatches of the design system tokens, "none" when
 * allowed, and a hex field for a one-off color.
 */
export function ColorField({
  label,
  value,
  tokens,
  onChange,
  allowNone,
  t,
}: {
  label: string;
  value: string | undefined;
  tokens: ThemeTokens;
  onChange: (value: string | undefined) => void;
  allowNone?: boolean;
  t: DeckT;
}) {
  const id = useId();
  const swatches = colorTokens(tokens);
  const [hex, setHex] = useState(value && value.startsWith("#") ? value : "");
  useEffect(() => setHex(value && value.startsWith("#") ? value : ""), [value]);
  return (
    <div className="de-field" role="group" aria-labelledby={id}>
      <span className="de-field-label" id={id}>
        {label}
      </span>
      <div className="de-swatches">
        {allowNone ? (
          <button
            type="button"
            className={`de-swatch de-swatch-none${!value ? " is-active" : ""}`}
            title={t("none")}
            aria-label={t("none")}
            aria-pressed={!value}
            onClick={() => onChange(undefined)}
          />
        ) : null}
        {swatches.map((sw) => (
          <button
            key={sw.name}
            type="button"
            className={`de-swatch${value === sw.name ? " is-active" : ""}`}
            style={{ background: sw.value }}
            title={`${sw.name} (${sw.value})`}
            aria-label={sw.name}
            aria-pressed={value === sw.name}
            onClick={() => onChange(sw.name)}
          />
        ))}
        <input
          className="de-hex"
          value={hex}
          placeholder="#hex"
          aria-label={`${label} hex`}
          maxLength={9}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => {
            if (HEX_RE.test(hex) && hex !== value) onChange(hex);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && HEX_RE.test(hex)) onChange(hex);
          }}
        />
      </div>
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="de-section">
      <header className="de-section-head">
        <h3>{title}</h3>
        {actions}
      </header>
      <div className="de-section-body">{children}</div>
    </section>
  );
}
