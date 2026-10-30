"use client";

/**
 * Icon picker of the Properties panel: the current icon, a search over the
 * whole lucide set and a grid of icons drawn as they will look. Without a
 * search it shows a short list of common icons.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { lucideIcon, lucideIconNames } from "@/components/deck-player/icons";
import type { DeckT } from "./strings";

const COMMON_ICONS = [
  "star",
  "check",
  "circle-check",
  "arrow-right",
  "rocket",
  "lightbulb",
  "target",
  "trending-up",
  "users",
  "shield-check",
  "zap",
  "heart",
  "globe",
  "chart-bar",
  "clock",
  "mail",
  "phone",
  "map-pin",
  "settings",
  "sparkles",
  "award",
  "briefcase",
  "calendar",
  "camera",
  "cloud",
  "code",
  "database",
  "dollar-sign",
  "flag",
  "gift",
  "graduation-cap",
  "handshake",
  "house",
  "key",
  "layers",
  "leaf",
  "lock",
  "megaphone",
  "message-circle",
  "package",
  "pie-chart",
  "puzzle",
  "search",
  "smartphone",
  "smile",
  "thumbs-up",
  "truck",
  "wallet",
];

const MAX_RESULTS = 120;

function IconTile({ name, active, onPick, disabled }: { name: string; active: boolean; onPick: () => void; disabled?: boolean }) {
  const Icon = lucideIcon(name);
  if (!Icon) return null;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      aria-label={name}
      title={name}
      className={`de-icon-tile${active ? " is-active" : ""}`}
      onClick={onPick}
      disabled={disabled}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function IconPicker({ value, onChange, disabled, t }: { value: string; onChange: (name: string) => void; disabled?: boolean; t: DeckT }) {
  const [query, setQuery] = useState("");
  const key = query.trim().toLowerCase().replace(/\s+/g, "-");
  const results = useMemo(() => {
    if (!key) return COMMON_ICONS.filter((name) => lucideIcon(name));
    const all = lucideIconNames();
    const starts = all.filter((name) => name.startsWith(key));
    const contains = all.filter((name) => !name.startsWith(key) && name.includes(key));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [key]);
  const Current = lucideIcon(value);
  return (
    <div className="de-icon-picker">
      <div className="de-icon-current">
        <span className="de-icon-current-glyph" aria-hidden>
          {Current ? <Current size={28} strokeWidth={1.75} /> : null}
        </span>
        <span className="de-icon-current-name">{value}</span>
      </div>
      <label className="de-font-search de-icon-search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          value={query}
          placeholder={t("iconSearch")}
          aria-label={t("iconSearch")}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              onChange(results[0]);
            }
          }}
        />
      </label>
      <p className="de-icon-caption">{key ? t("iconResults", { n: results.length }) : t("iconCommon")}</p>
      {results.length ? (
        <div className="de-icon-grid" role="listbox" aria-label={t("icon")}>
          {results.map((name) => (
            <IconTile key={name} name={name} active={value === name} disabled={disabled} onPick={() => onChange(name)} />
          ))}
        </div>
      ) : (
        <p className="de-font-empty">{t("iconNoMatch")}</p>
      )}
    </div>
  );
}
