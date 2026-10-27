"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";

import "@/styles/forge/pages.css";

import { StepsMark } from "@/components/app/Marks";
import { projectState, type AppProject } from "@/components/app/project-data";
import { ProjectCard, ProjectRow } from "@/components/app/ProjectCard";
import { useProjectActions } from "@/components/app/useProjectActions";
import { filterProjects, isOwned, kindOf, type ProjectScope } from "@/components/home/projects";
import { useHomeSetting } from "@/components/home/use-home-prefs";
import { AppShell } from "@/components/shell/AppShell";
import { APP_ROUTES } from "@/components/shell/nav";
import { FilterChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { SearchInput } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Tabs";
import { getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { normalizeKind, useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import { ensureProjects, getCachedProjects, subscribeProjects } from "@/lib/lists-cache";
import { useMediaToken } from "@/lib/media-token";
import { useWorkspaceActivity } from "@/lib/workspace-activity";

const PAGE_SIZE = 24;

function kindParam(raw: string | null): ProjectKindId | "all" {
  if (!raw || raw === "all") return "all";
  return normalizeKind(raw);
}

function ProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const mediaToken = useMediaToken();
  const activity = useWorkspaceActivity();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<ProjectKindId | "all">(() => kindParam(params.get("kind")));
  const [scope, setScope] = useState<ProjectScope>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useHomeSetting("view", "grid", ["grid", "list"] as const);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { actions, dialogs, favorites } = useProjectActions((change) => {
    if (change.removed) setProjects((prev) => prev.filter((p) => p.id !== change.removed));
    if (change.added) setProjects((prev) => [change.added as AppProject, ...prev]);
    if (change.patched) setProjects((prev) => prev.map((p) => (p.id === change.patched?.id ? { ...p, ...change.patched } : p)));
  });

  useEffect(() => {
    setMounted(true);
    if (!getToken()) {
      router.replace("/login?next=/projects");
      return;
    }
    const warm = getCachedProjects(locale);
    if (warm) {
      setProjects(warm as AppProject[]);
      setLoading(false);
    }
    let alive = true;
    ensureProjects(locale, { force: true })
      .then((list) => alive && setProjects(list as AppProject[]))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : t("errorGeneric")))
      .finally(() => alive && setLoading(false));
    const unsub = subscribeProjects(() => {
      const cached = getCachedProjects(locale);
      if (cached) setProjects(cached as AppProject[]);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [locale, router, t]);

  useEffect(() => setKind(kindParam(params.get("kind"))), [params]);
  useEffect(() => setVisible(PAGE_SIZE), [kind, scope, favoritesOnly, query]);

  function chooseKind(next: ProjectKindId | "all") {
    setKind(next);
    router.replace(next === "all" ? APP_ROUTES.projects : `${APP_ROUTES.projects}?kind=${next}`, { scroll: false });
  }

  const counts = useMemo(() => {
    const out: Partial<Record<ProjectKindId, number>> = {};
    for (const p of projects) out[kindOf(p)] = (out[kindOf(p)] ?? 0) + 1;
    return out;
  }, [projects]);
  const sharedCount = projects.filter((p) => !isOwned(p)).length;
  const rows = useMemo(
    () => filterProjects(projects, { scope, kind: kind === "all" ? null : kind, query, favoritesOnly, favorites }) as AppProject[],
    [projects, scope, kind, query, favoritesOnly, favorites],
  );
  const filtered = kind !== "all" || scope !== "all" || favoritesOnly || query.trim() !== "";
  const shown = rows.slice(0, visible);
  const lead =
    projects.length === 0
      ? t("apProjectsLeadNone")
      : (sharedCount ? t("apProjectsLeadShared") : t("apProjectsLead"))
          .replace("{n}", String(projects.length))
          .replace("{m}", String(sharedCount));

  return (
    <AppShell active="projects" title={t("uiNavProjects")}>
      <div className="f-page-head">
        <div>
          <h1>{t("apProjectsTitle")}</h1>
          <p>{loading && !projects.length ? t("loading") : lead}</p>
        </div>
        <Button icon="plus" href={APP_ROUTES.create}>
          {t("uiNewProject")}
        </Button>
      </div>

      <div className="f-toolbar">
        <div className="f-chip-row" role="group" aria-label={t("apFilterKind")}>
          <FilterChip pressed={kind === "all"} count={projects.length} onClick={() => chooseKind("all")}>
            {t("apAll")}
          </FilterChip>
          {enabledKinds.map((k) => (
            <FilterChip key={k} pressed={kind === k} dot={kindStyle(k).color} count={counts[k] ?? 0} onClick={() => chooseKind(k)}>
              {t(kindStyle(k).labelKey)}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="f-toolbar">
        <SearchInput
          label={t("apSearchProjects")}
          placeholder={t("apSearchProjects")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Segmented
          label={t("apFilterOwner")}
          value={scope}
          onChange={setScope}
          items={[
            { id: "all", label: t("apAll") },
            { id: "mine", label: t("apMine") },
            { id: "shared", label: t("apSharedWithMe") },
          ]}
        />
        <FilterChip pressed={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
          <Glyph name="star" size="sm" />
          {t("apFavorites")}
        </FilterChip>
        <span className="f-toolbar-spacer" />
        <Segmented
          label={t("apView")}
          value={view}
          onChange={setView}
          items={[
            { id: "grid", label: <Glyph name="grid" size="sm" label={t("apViewGrid")} /> },
            { id: "list", label: <Glyph name="list" size="sm" label={t("apViewList")} /> },
          ]}
        />
      </div>

      {error ? (
        <p className="f-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !projects.length ? (
        <div className="f-pgrid" aria-busy="true" aria-label={t("loading")}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="f-pcard" aria-hidden>
              <div className="f-pthumb f-skel" />
              <div className="f-skel" style={{ height: 18, width: "60%", borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <section className="f-panel f-empty">
          <span className="f-empty-mark">
            <StepsMark />
          </span>
          <h2>{favoritesOnly ? t("apNoFavorites") : t("apNothingHere")}</h2>
          <p>{filtered ? t("apNothingMatches") : t("apNoProjectsYet")}</p>
          <Button icon="plus" href={APP_ROUTES.create}>
            {t("uiNewProject")}
          </Button>
        </section>
      ) : view === "grid" ? (
        <div className="f-pgrid">
          {!filtered ? (
            <article className="f-pcard is-new" style={{ "--i": 0 } as CSSProperties}>
              <Link className="f-pthumb" href={APP_ROUTES.create}>
                <div>
                  <Glyph name="plus" size="lg" />
                  <span>{t("uiNewProject")}</span>
                </div>
              </Link>
              <div className="f-pcard-meta">
                <div className="txt">
                  <h3>{t("apStartScratch")}</h3>
                  <div className="sub">{t("apOrTemplate")}</div>
                </div>
              </div>
            </article>
          ) : null}
          {shown.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              state={projectState(project, activity.states)}
              actions={actions}
              mediaToken={mediaToken}
              mounted={mounted}
              index={i + 1}
            />
          ))}
        </div>
      ) : (
        <div className="f-plist" role="table" aria-label={t("apProjectsTitle")}>
          <div className="f-prow head" role="row">
            <span role="columnheader" />
            <span role="columnheader">{t("apColName")}</span>
            <span role="columnheader">{t("apColKind")}</span>
            <span role="columnheader">{t("apColStatus")}</span>
            <span role="columnheader">{t("apColEdited")}</span>
            <span role="columnheader" />
          </div>
          {shown.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              state={projectState(project, activity.states)}
              actions={actions}
              mediaToken={mediaToken}
              mounted={mounted}
            />
          ))}
        </div>
      )}
      {rows.length > visible ? (
        <div className="f-more-row">
          <Button variant="dark" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
      {dialogs}
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}
