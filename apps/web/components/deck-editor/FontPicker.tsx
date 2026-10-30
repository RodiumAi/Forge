"use client";

/**
 * Font menu of the format bar, in two tabs. Fonts: a search field, the theme
 * fonts, then every family by category, each name written in its own font
 * (families load from Google Fonts once their row scrolls into view). Text
 * styles: the text roles, each shown at its relative size.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ensureFonts, fontChoices, type FontCategory, type ThemeTokens } from "@/components/deck-player";
import { Popover } from "@/components/ui/Popover";
import type { DeckT } from "./strings";
import { ROLE_SIZES } from "./text-style";

/** Text roles, largest first, as the Text styles tab lists them. */
export const TEXT_ROLES = [
  ["title", "roleTitle"],
  ["heading", "roleHeading"],
  ["subtitle", "roleSubtitle"],
  ["quote", "roleQuote"],
  ["body", "roleBody"],
  ["caption", "roleCaption"],
  ["label", "roleLabel"],
] as const;

const FONT_GROUPS: [FontCategory, "fontGroupSans" | "fontGroupSerif" | "fontGroupDisplay" | "fontGroupMono"][] = [
  ["sans", "fontGroupSans"],
  ["serif", "fontGroupSerif"],
  ["display", "fontGroupDisplay"],
  ["mono", "fontGroupMono"],
];

const THEME_ROLES = [
  ["role:display", "fontDisplay", "--font-display"],
  ["role:body", "fontBody", "--font-body"],
  ["role:mono", "fontMono", "--font-mono"],
] as const;

/** Folds case and accents so "geo" finds "Géo". */
export function fontSearchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Loads a family when its row first becomes visible in the list. */
function FontRow({ family, selected, onPick }: { family: string; selected: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      ensureFonts([family]);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        ensureFonts([family]);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [family]);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      className="f-menu-item de-font-item"
      style={{ fontFamily: `"${family}", sans-serif` }}
      onClick={onPick}
    >
      <span>{family}</span>
      {selected ? <Check size={14} aria-hidden /> : null}
    </button>
  );
}

export function FontPicker({
  value,
  family,
  tokens,
  onChange,
  role,
  onRole,
  disabled,
  t,
}: {
  /** "", "role:display" or "family:Inter". */
  value: string;
  /** Family the text renders with now, for the trigger. */
  family?: string;
  tokens: ThemeTokens;
  onChange: (value: string) => void;
  /** Text role of the element, for the Text styles tab. */
  role?: string;
  /** Sets the role; without it the menu has no Text styles tab. */
  onRole?: (role: string | undefined) => void;
  disabled?: boolean;
  t: DeckT;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"fonts" | "styles">("fonts");
  const choices = useMemo(() => fontChoices(), []);
  const key = fontSearchKey(query);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("fonts");
    }
  }, [open]);
  useEffect(() => {
    if (family) ensureFonts([family]);
  }, [family]);

  const themeRows = THEME_ROLES.filter(([, label]) => !key || fontSearchKey(t(label)).includes(key));
  const groups = FONT_GROUPS.map(([category, label]) => [label, choices[category].filter((name) => !key || fontSearchKey(name).includes(key))] as const).filter(
    ([, names]) => names.length > 0,
  );
  const first = themeRows[0]?.[0] ?? (groups[0] ? `family:${groups[0][1][0]}` : null);
  const triggerLabel = value.startsWith("family:")
    ? value.slice(7)
    : (THEME_ROLES.find(([v]) => v === value)?.[1] && t(THEME_ROLES.find(([v]) => v === value)![1])) || t("font");

  return (
    <Popover
      role="dialog"
      label={t("font")}
      width={280}
      className="de-font-pop"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className="de-font-trigger"
          disabled={disabled}
          title={t("font")}
          aria-label={`${t("font")}: ${triggerLabel}`}
          style={family ? { fontFamily: `"${family}", sans-serif` } : undefined}
        >
          <span>{triggerLabel}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
      }
    >
      {(close) => {
        const pick = (next: string) => {
          close();
          onChange(next);
        };
        return (
          <div className="de-font-panel">
            {onRole ? (
              <div className="de-font-tabs" role="tablist" aria-label={t("font")}>
                {(
                  [
                    ["fonts", "font"],
                    ["styles", "fontTabStyles"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    className={`de-font-tab${tab === id ? " is-active" : ""}`}
                    onClick={() => setTab(id)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            ) : null}
            {onRole && tab === "styles" ? (
              <div className="de-font-list de-style-list" role="listbox" aria-label={t("fontTabStyles")}>
                {TEXT_ROLES.map(([r, label]) => {
                  const size = ROLE_SIZES[r] ?? 32;
                  const display = r === "title" || r === "heading" || r === "subtitle";
                  return (
                    <button
                      key={r}
                      type="button"
                      role="option"
                      aria-selected={role === r}
                      className="f-menu-item de-style-item"
                      onClick={() => {
                        close();
                        onRole(r);
                      }}
                    >
                      <span
                        style={{
                          fontFamily: tokens[display ? "--font-display" : "--font-body"],
                          fontSize: Math.min(34, Math.max(12, Math.round(size / 2.8))),
                          fontWeight: r === "title" || r === "heading" ? 700 : r === "label" ? 600 : 400,
                          fontStyle: r === "quote" ? "italic" : undefined,
                          textTransform: r === "label" ? "uppercase" : undefined,
                          letterSpacing: r === "label" ? "0.08em" : undefined,
                        }}
                      >
                        {t(label)}
                      </span>
                      <span className="de-style-size">{size} px</span>
                      {role === r ? <Check size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="option"
                  aria-selected={!role}
                  className="f-menu-item de-style-item de-style-free"
                  onClick={() => {
                    close();
                    onRole(undefined);
                  }}
                >
                  <span>{t("roleNone")}</span>
                  {!role ? <Check size={14} aria-hidden /> : null}
                </button>
              </div>
            ) : (
              <>
            <label className="de-font-search">
              <Search size={14} aria-hidden />
              <input
                autoFocus
                type="search"
                value={query}
                placeholder={t("fontSearch")}
                aria-label={t("fontSearch")}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && first) {
                    e.preventDefault();
                    pick(first);
                  }
                }}
              />
            </label>
            <div className="de-font-list" role="listbox" aria-label={t("font")}>
              {themeRows.length ? (
                <div className="de-font-group">
                  <p>{t("fontGroupTheme")}</p>
                  {themeRows.map(([v, label, token]) => (
                    <button
                      key={v}
                      type="button"
                      role="option"
                      aria-selected={value === v}
                      className="f-menu-item de-font-item"
                      style={{ fontFamily: tokens[token] }}
                      onClick={() => pick(v)}
                    >
                      <span>{t(label)}</span>
                      {value === v ? <Check size={14} aria-hidden /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {groups.map(([label, names]) => (
                <div key={label} className="de-font-group">
                  <p>{t(label)}</p>
                  {names.map((name) => (
                    <FontRow key={name} family={name} selected={value === `family:${name}`} onPick={() => pick(`family:${name}`)} />
                  ))}
                </div>
              ))}
              {!themeRows.length && !groups.length ? <p className="de-font-empty">{t("fontNoMatch")}</p> : null}
            </div>
              </>
            )}
          </div>
        );
      }}
    </Popover>
  );
}
