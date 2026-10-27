"use client";

import { FolderOpen, LayoutGrid, List, Palette, Plus, Search, Star } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { KIND_LABEL_KEYS } from "@/components/home/home-kinds";
import type { ProjectActions } from "@/components/home/ProjectCard";
import { ProjectGrid } from "@/components/home/ProjectGrid";
import { ProjectList } from "@/components/home/ProjectList";
import {
  PROJECT_SCOPES,
  filterProjects,
  kindOf,
  type HomeProject,
  type ProjectScope,
} from "@/components/home/projects";
import { useHomeSetting } from "@/components/home/use-home-prefs";
import { TemplateGallery, type GalleryTemplate } from "@/components/TemplateGallery";
import { Icon } from "@/components/ui/icon";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectKindId } from "@/lib/kinds";

export type HomeTab = "projects" | "design_systems" | "templates";
export const HOME_TABS: readonly HomeTab[] = ["projects", "design_systems", "templates"];

const TAB_LABELS: Record<HomeTab, MessageKey> = {
  projects: "homeTabProjects",
  design_systems: "homeTabDesignSystems",
  templates: "homeTabTemplates",
};

const SCOPE_LABELS: Record<ProjectScope, MessageKey> = {
  all: "homeFilterAll",
  mine: "homeFilterMine",
  shared: "homeFilterShared",
};

const PAGE_SIZE = 24;

type Props = {
  tab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
  enabledKinds: readonly ProjectKindId[];
  projects: readonly HomeProject[];
  /** Rows of the Design systems tab (GET /design-systems, team ones included); falls back to `projects`. */
  designSystems?: readonly HomeProject[];
  loading: boolean;
  error?: string | null;
  actions: ProjectActions;
  favorites: ReadonlySet<string>;
  mediaToken: string | null;
  mounted: boolean;
  templates: GalleryTemplate[];
  galleryKind: ProjectKindId;
  onGalleryKindChange: (kind: ProjectKindId) => void;
  /** Search the gallery opens with (a shortcut tile seeds it). */
  galleryQuery?: string;
  forkingId: string | null;
  onFork: (template: GalleryTemplate) => void;
  /** Creates an empty project of the gallery's kind. */
  onStartBlank: (kind: ProjectKindId) => void;
  onNewDesignSystem: () => void;
  busy: boolean;
};

/** Projets / Design systems / Modèles, with search, filters, favourites and list or grid. */
export function HomeTabs(props: Props) {
  const { tab, onTabChange, enabledKinds, projects, loading, actions, favorites, mediaToken, mounted } = props;
  const { t } = useI18n();
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<HomeTab, HTMLButtonElement | null>>>({});
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ProjectScope>("all");
  const [kindFilter, setKindFilter] = useState<ProjectKindId | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useHomeSetting("view", "grid", ["grid", "list"] as const);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const tabs = HOME_TABS.filter((id) => id !== "design_systems" || enabledKinds.includes("design_system"));

  // A filter or a tab change starts again from the first page, so a big
  // render (and its thumbnails) never stays mounted behind a narrower view.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, scope, kindFilter, favoritesOnly, tab]);

  useEffect(() => {
    setQuery("");
  }, [tab]);

  const rows = useMemo(() => {
    const pool =
      tab === "design_systems"
        ? (props.designSystems ?? projects.filter((p) => kindOf(p) === "design_system"))
        : projects;
    return filterProjects(pool, {
      scope,
      kind: tab === "design_systems" ? null : kindFilter,
      query,
      favoritesOnly,
      favorites,
    });
  }, [tab, projects, props.designSystems, scope, kindFilter, query, favoritesOnly, favorites]);

  function onTabKey(event: React.KeyboardEvent, current: HomeTab) {
    const index = tabs.indexOf(current);
    let next: HomeTab | null = null;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    if (next) {
      event.preventDefault();
      onTabChange(next);
      tabRefs.current[next]?.focus();
    }
  }

  const listLabel = t(TAB_LABELS[tab]);
  const shown = rows.slice(0, visible);

  return (
    <section className="fdh-tabs" aria-label={t("homeTabsAria")}>
      <div className="fdh-tabs-head">
        <div className="fdh-tablist" role="tablist" aria-label={t("homeTabsAria")}>
          {tabs.map((id) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? "active" : undefined}
              onClick={() => onTabChange(id)}
              onKeyDown={(event) => onTabKey(event, id)}
            >
              {t(TAB_LABELS[id])}
            </button>
          ))}
        </div>

        {tab !== "templates" ? (
          <div className="fdh-toolbar">
            <label className="fdh-search">
              <Icon icon={Search} className="ui-icon-sm" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === "design_systems" ? t("homeSearchDesignSystems") : t("homeSearchProjects")}
                aria-label={tab === "design_systems" ? t("homeSearchDesignSystems") : t("homeSearchProjects")}
              />
            </label>
            <div className="fdh-segment" role="group" aria-label={t("homeFilterScopeAria")}>
              {PROJECT_SCOPES.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={scope === id}
                  className={scope === id ? "active" : undefined}
                  onClick={() => setScope(id)}
                >
                  {t(SCOPE_LABELS[id])}
                </button>
              ))}
            </div>
            {tab === "projects" && enabledKinds.length > 1 ? (
              <select
                className="fdh-select"
                aria-label={t("homeFilterKindAria")}
                value={kindFilter ?? ""}
                onChange={(event) => setKindFilter((event.target.value || null) as ProjectKindId | null)}
              >
                <option value="">{t("homeFilterKindAll")}</option>
                {enabledKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(KIND_LABEL_KEYS[kind])}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className={`fdh-pill fdh-fav-filter${favoritesOnly ? " is-on" : ""}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              <Icon icon={Star} className="ui-icon-sm" />
              <span>{t("homeFilterFavorites")}</span>
            </button>
            <div className="fdh-segment fdh-view" role="group" aria-label={t("homeViewAria")}>
              <button
                type="button"
                aria-pressed={view === "list"}
                aria-label={t("homeViewList")}
                title={t("homeViewList")}
                className={view === "list" ? "active" : undefined}
                onClick={() => setView("list")}
              >
                <Icon icon={List} className="ui-icon-sm" />
              </button>
              <button
                type="button"
                aria-pressed={view === "grid"}
                aria-label={t("homeViewGrid")}
                title={t("homeViewGrid")}
                className={view === "grid" ? "active" : undefined}
                onClick={() => setView("grid")}
              >
                <Icon icon={LayoutGrid} className="ui-icon-sm" />
              </button>
            </div>
            {tab === "design_systems" ? (
              <button type="button" className="fdh-pill fdh-new" onClick={props.onNewDesignSystem} disabled={props.busy}>
                <Icon icon={Plus} className="ui-icon-sm" />
                <span>{t("homeNewDesignSystem")}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className="fdh-panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        tabIndex={0}
      >
        {props.error ? <p className="error home-panel-error">{props.error}</p> : null}
        {tab === "templates" ? (
          <>
            <div className="fdh-gallery-actions">
              <button
                type="button"
                className="fdh-pill fdh-new"
                onClick={() => props.onStartBlank(props.galleryKind)}
                disabled={props.busy}
              >
                <Icon icon={Plus} className="ui-icon-sm" />
                <span>{t("homeStartBlank")}</span>
              </button>
            </div>
            {props.templates.length > 0 ? (
              <TemplateGallery
                key={`${props.galleryKind}:${props.galleryQuery ?? ""}`}
                templates={props.templates}
                onSelect={props.onFork}
                busyId={props.forkingId}
                useError={props.error ?? null}
                variant="home"
                kind={props.galleryKind}
                onKindChange={props.onGalleryKindChange}
                initialQuery={props.galleryQuery}
              />
            ) : (
              <p className="home-panel-empty">{t("noTemplates")}</p>
            )}
          </>
        ) : loading ? (
          <div className="home-grid home-grid-3" aria-busy="true" aria-label={t("loading")}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="home-card home-card-skel" aria-hidden>
                <div className="home-skel home-card-skel-thumb" />
                <div className="home-card-body">
                  <div className="home-skel home-card-skel-title" />
                  <div className="home-skel home-card-skel-meta" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="home-empty">
            <span className="home-empty-mark" aria-hidden>
              <Icon icon={tab === "design_systems" ? Palette : FolderOpen} />
            </span>
            <strong>
              {favoritesOnly
                ? t("homeNoFavorites")
                : tab === "design_systems"
                  ? t("homeEmptyDesignSystems")
                  : t("noProjects")}
            </strong>
            {!favoritesOnly ? (
              <p>
                {query.trim()
                  ? t("noProjectsSearch")
                  : tab === "design_systems"
                    ? t("homeEmptyDesignSystemsHint")
                    : t("noProjectsHint")}
              </p>
            ) : null}
          </div>
        ) : view === "list" ? (
          <ProjectList projects={shown} actions={actions} mounted={mounted} label={listLabel} />
        ) : (
          <ProjectGrid projects={shown} actions={actions} mediaToken={mediaToken} mounted={mounted} label={listLabel} />
        )}
        {tab !== "templates" && !loading && rows.length > visible ? (
          <div className="home-panel-more">
            <button type="button" className="home-load-more" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
              {t("loadMore")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
