"use client";

/**
 * Pages rail of the site and app builder, modelled on the deck editor's slide
 * rail: every detected page with a thumbnail, click to open it in the
 * preview, Ctrl/Cmd or Shift click (or the checkbox) to pick pages the next
 * chat request applies to. Thumbnails are snapshots taken when a page is
 * shown in the preview; a page never opened shows its name instead.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, PanelBottom, PanelLeft, X } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { nextPageSelection, pageLabel, PageThumbCache } from "./page-rail-model";
import "./page-rail.css";

export type RailPlacement = "left" | "bottom";

/** One cache for the whole tab: switching projects keeps every snapshot. */
export const pageThumbs = new PageThumbCache();

const subscribe = (fn: () => void) => pageThumbs.subscribe(fn);
const snapshot = () => pageThumbs.getVersion();
const serverSnapshot = () => -1;

type Props = {
  projectId: string;
  pages: string[];
  currentPath: string;
  /** Phone apps: portrait thumbnails. */
  mobile: boolean;
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  onNavigate: (path: string) => void;
  placement: RailPlacement;
  onPlacementChange: (next: RailPlacement) => void;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  /** Screens switched by a state instead of routes (older projects). */
  stateScreens?: string[];
  /** Prefills the composer with the request to turn them into pages. */
  onConvertPages?: () => void;
};

export function PageRail({
  projectId,
  pages,
  currentPath,
  mobile,
  selected,
  onSelectedChange,
  onNavigate,
  placement,
  onPlacementChange,
  collapsed,
  onCollapsedChange,
  stateScreens = [],
  onConvertPages,
}: Props) {
  const { t } = useI18n();
  const horizontal = placement === "bottom";
  // -1 on the server and during hydration: no storage read before mount.
  const version = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const anchorRef = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const home = t("bdPagesHome");
  const [focusPath, setFocusPath] = useState<string | null>(null);

  // Keep the page on screen visible in a long list.
  useEffect(() => {
    if (collapsed) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-rail-page="${CSS.escape(currentPath)}"]`);
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [currentPath, collapsed, pages.length]);

  /** Ctrl/Cmd click toggles a page, Shift click selects a range. True when handled. */
  const pick = (path: string, e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onSelectedChange(nextPageSelection(selected, path, "toggle", pages));
      anchorRef.current = path;
      return true;
    }
    if (e.shiftKey) {
      onSelectedChange(nextPageSelection(selected, path, "range", pages, anchorRef.current ?? currentPath));
      anchorRef.current = path;
      return true;
    }
    return false;
  };

  const onThumbKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = horizontal ? ["ArrowRight", "ArrowDown"] : ["ArrowDown"];
    const prev = horizontal ? ["ArrowLeft", "ArrowUp"] : ["ArrowUp"];
    if (next.includes(e.key) || prev.includes(e.key)) {
      e.preventDefault();
      const to = Math.max(0, Math.min(pages.length - 1, index + (next.includes(e.key) ? 1 : -1)));
      const path = pages[to];
      setFocusPath(path);
      requestAnimationFrame(() =>
        listRef.current?.querySelector<HTMLButtonElement>(`[data-rail-page="${CSS.escape(path)}"] .f-pr-thumb`)?.focus(),
      );
    }
  };

  const count = pages.length;
  // Roving tab stop: one thumbnail in the tab order, arrows move between them.
  const tabStop = focusPath && pages.includes(focusPath) ? focusPath : pages.includes(currentPath) ? currentPath : pages[0];
  const toggleLabel = horizontal ? t("bdPagesToLeft") : t("bdPagesToBottom");

  if (collapsed && !horizontal) {
    return (
      <button
        type="button"
        className="f-pr-reopen"
        onClick={() => onCollapsedChange(false)}
        aria-label={t("bdPagesExpand")}
        title={t("bdPagesExpand")}
      >
        <ChevronRight size={15} aria-hidden />
        <span>
          {t("bdPagesTitle")} · {count}
        </span>
      </button>
    );
  }

  return (
    <nav
      className={`f-pr${horizontal ? " is-horizontal" : ""}${collapsed ? " is-collapsed" : ""}${mobile ? " is-mobile" : ""}`}
      aria-label={t("bdPagesTitle")}
    >
      <div className="f-pr-head">
        <span className="f-pr-title" title={t("bdPagesSelectHint")}>
          {t("bdPagesTitle")} <span className="f-pr-count">{count}</span>
        </span>
        {selected.length ? (
          <button
            type="button"
            className="f-pr-selcount"
            onClick={() => onSelectedChange([])}
            title={`${t("bdPagesSelectedN").replace("{n}", String(selected.length))} · ${t("bdPagesClear")}`}
            aria-label={`${t("bdPagesSelectedN").replace("{n}", String(selected.length))}, ${t("bdPagesClear")}`}
          >
            <Check size={12} aria-hidden /> {selected.length} <X size={12} aria-hidden />
          </button>
        ) : null}
        <span className="f-pr-sp" />
        <button
          type="button"
          className="f-pr-icon"
          onClick={() => onPlacementChange(horizontal ? "left" : "bottom")}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {horizontal ? <PanelLeft size={15} aria-hidden /> : <PanelBottom size={15} aria-hidden />}
        </button>
        <button
          type="button"
          className="f-pr-icon"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? t("bdPagesExpand") : t("bdPagesCollapse")}
          title={collapsed ? t("bdPagesExpand") : t("bdPagesCollapse")}
          aria-expanded={!collapsed}
        >
          {horizontal ? (
            collapsed ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />
          ) : (
            <ChevronLeft size={15} aria-hidden />
          )}
        </button>
      </div>
      {collapsed ? null : (
        <ol className="f-pr-list" ref={listRef}>
          {pages.map((path, index) => {
            const label = pageLabel(path, home);
            const active = path === currentPath;
            const checked = selected.includes(path);
            const src = version >= 0 ? pageThumbs.get(projectId, path) : null;
            return (
              <li
                key={path}
                data-rail-page={path}
                className={`f-pr-item${active ? " is-active" : ""}${checked ? " is-selected" : ""}`}
              >
                <span className="f-pr-num" aria-hidden>
                  {index + 1}
                </span>
                <div className="f-pr-card">
                  <button
                    type="button"
                    className="f-pr-thumb"
                    aria-current={active ? "page" : undefined}
                    aria-label={`${label} (${path})`}
                    title={`${label} · ${path}`}
                    tabIndex={path === tabStop ? 0 : -1}
                    onFocus={() => setFocusPath(path)}
                    onClick={(e) => {
                      if (pick(path, e)) return;
                      anchorRef.current = path;
                      onNavigate(path);
                    }}
                    onKeyDown={(e) => onThumbKey(e, index)}
                  >
                    {src ? (
                      <img src={src} alt="" draggable={false} />
                    ) : (
                      <span className="f-pr-ph" title={t("bdPagesNotVisited")}>
                        <FileText size={16} aria-hidden />
                        <span>{label}</span>
                      </span>
                    )}
                  </button>
                  <label className="f-pr-check" title={t("bdPagesSelect")}>
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`${t("bdPagesSelect")}: ${label}`}
                      onChange={() => {
                        onSelectedChange(nextPageSelection(selected, path, "toggle", pages));
                        anchorRef.current = path;
                      }}
                    />
                  </label>
                  <span className="f-pr-label">{label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {!collapsed && stateScreens.length && onConvertPages ? (
        <div className="f-pr-convert" role="note">
          <strong>{t("bdPagesConvertTitle").replace("{n}", String(stateScreens.length))}</strong>
          <p>{t("bdPagesConvertHint")}</p>
          <button type="button" onClick={onConvertPages}>
            {t("bdPagesConvertCta")}
          </button>
        </div>
      ) : null}
    </nav>
  );
}
