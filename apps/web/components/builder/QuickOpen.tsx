"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FileTypeIcon } from "./file-icons";

/**
 * Ctrl/Cmd+P file switcher.
 *
 * The file tree had no search at all: on a project with a hundred files the
 * only way to reach one was to expand folders by hand.
 */

/** Subsequence match, the usual "fzf" behaviour. Returns a score or -1. */
function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let score = 0;
  let hi = 0;
  let streak = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const found = h.indexOf(n[ni], hi);
    if (found === -1) return -1;
    // Reward consecutive characters and matches right after a separator.
    streak = found === hi ? streak + 1 : 0;
    score += 10 + streak * 5;
    if (found === 0 || "/-_.".includes(h[found - 1])) score += 8;
    hi = found + 1;
  }
  // Prefer shorter paths and matches in the filename.
  score -= Math.floor(haystack.length / 10);
  const base = h.split("/").pop() || h;
  if (base.includes(n)) score += 25;
  return score;
}

export function QuickOpen({
  open,
  files,
  onClose,
  onPick,
}: {
  open: boolean;
  files: string[];
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50);
    return files
      .map((path) => ({ path, score: fuzzyScore(path, query.trim()) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((r) => r.path);
  }, [files, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active];
      if (pick) onPick(pick);
    }
  }

  return (
    <div className="quick-open-root" role="presentation">
      <div className="quick-open-backdrop" onClick={onClose} />
      <div
        className="quick-open"
        role="dialog"
        aria-modal="true"
        aria-label={t("codeQuickOpen")}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="quick-open-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("codeQuickOpenPlaceholder")}
          role="combobox"
          aria-expanded
          aria-controls="quick-open-list"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {results.length === 0 ? (
          <p className="quick-open-empty">{t("codeQuickOpenEmpty")}</p>
        ) : (
          <ul id="quick-open-list" className="quick-open-list" role="listbox" ref={listRef}>
            {results.map((path, i) => {
              const name = path.split("/").pop() || path;
              const dir = path.slice(0, path.length - name.length).replace(/\/$/, "");
              return (
                <li
                  key={path}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  className={`quick-open-item${i === active ? " active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(path);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <FileTypeIcon path={path} />
                  <span className="quick-open-name">{name}</span>
                  {dir ? <span className="quick-open-dir">{dir}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
