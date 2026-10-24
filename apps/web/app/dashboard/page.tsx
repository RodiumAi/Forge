"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import "@/styles/forge/pages.css";

import { legacyTabTarget } from "@/components/app/legacy-routes";
import { HeroBackdrop } from "@/components/app/Marks";
import { projectHref, projectState, type AppProject } from "@/components/app/project-data";
import { ProjectCard, useStateLabel } from "@/components/app/ProjectCard";
import { ProjectThumb } from "@/components/app/ProjectThumb";
import { useProjectActions } from "@/components/app/useProjectActions";
import { useToast } from "@/components/app/useToast";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { Composer, type ComposerDesignSystem, type ComposerHandle } from "@/components/composer/Composer";
import { listDesignSystems, type DesignSystemList } from "@/components/design-system/api";
import { buildCreateRequest, getTile, type HomeTile, type HomeTileId } from "@/components/home/home-kinds";
import { kindOf } from "@/components/home/projects";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { AppShell } from "@/components/shell/AppShell";
import { daysUntil, formatCount } from "@/components/shell/FrodiCard";
import { APP_ROUTES, GITHUB_URL } from "@/components/shell/nav";
import { invalidateThumbCache } from "@/components/SiteThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { TeamInviteNotice } from "@/components/TeamInviteNotice";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { Badge, StatePill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { StairsMeter } from "@/components/ui/Meter";
import { ApiError, getToken } from "@/lib/api";
import { PromptTooLongError } from "@/lib/constants/prompt";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import {
  PENDING_PROMPT_KEY,
  PENDING_TEMPLATE_KEY,
  clearPendingCreateOptions,
  clearPendingPlatform,
  createBlankProject,
  createProjectWithAttachments,
  ensureCanGenerate,
  fetchProjectQuota,
  forkProjectFromTemplate,
  readPendingCreateOptions,
  readPendingPlatform,
  restorePendingFilesAsAttachments,
  type CreateOptions,
  type CreatedProject,
  type DeckRatio,
  type ProjectQuota,
} from "@/lib/create-project";
import { useForgeStatus } from "@/lib/forge-status";
import { frodiUsage } from "@/lib/frodi-usage";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import {
  ensureProjects,
  ensureTemplates,
  getCachedProjects,
  getCachedTemplates,
  prependProject,
  refreshTemplatesIfStale,
  subscribeProjects,
} from "@/lib/lists-cache";
import { useMediaToken } from "@/lib/media-token";
import {
  PromptAttachment,
  createPromptAttachment,
  mergePromptAttachments,
  revokePromptAttachment,
  type PromptLabels,
} from "@/lib/prompt-attachments";
import { getSessionSnapshot, subscribeSession, type SessionProfile } from "@/lib/session-cache";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";
import { refreshWorkspaceActivity, useWorkspaceActivity, type ActiveRun } from "@/lib/workspace-activity";

const DESIGN_SYSTEM_KEY = "forge_home_design_system";

const WEB_SUGGESTIONS = ["promptSuggest1", "promptSuggest2", "promptSuggest3", "promptSuggest4", "promptSuggest5"] as const;
const MOBILE_SUGGESTIONS = [
  "promptSuggestMobile1",
  "promptSuggestMobile2",
  "promptSuggestMobile3",
  "promptSuggestMobile4",
  "promptSuggestMobile5",
] as const;

const KIND_HINTS: Record<ProjectKindId, MessageKey> = {
  web: "apKindHintWeb",
  mobile: "apKindHintMobile",
  slides: "apKindHintSlides",
  codelab: "apKindHintCodelab",
  design_system: "apKindHintDesignSystem",
};

const NEWS: { kind: ProjectKindId; glyph: GlyphName; title: MessageKey; body: MessageKey }[] = [
  { kind: "slides", glyph: "presentation", title: "apNewsSlidesTitle", body: "apNewsSlidesBody" },
  { kind: "codelab", glyph: "book", title: "apNewsCodelabTitle", body: "apNewsCodelabBody" },
  { kind: "design_system", glyph: "palette", title: "apNewsDsTitle", body: "apNewsDsBody" },
];

/** Template picks of the overview: a mix of kinds, decks first (they play on hover). */
function pickTemplates(templates: GalleryTemplate[], enabled: readonly ProjectKindId[], n = 6): GalleryTemplate[] {
  const byKind = new Map<ProjectKindId, GalleryTemplate[]>();
  for (const tpl of templates) {
    const kind = (tpl.kind ?? "web") as ProjectKindId;
    if (!enabled.includes(kind)) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), tpl]);
  }
  const order: ProjectKindId[] = ["slides", "web", "mobile", "codelab", "design_system"];
  const out: GalleryTemplate[] = [];
  for (let round = 0; out.length < n && round < 6; round += 1) {
    for (const kind of order) {
      const next = byKind.get(kind)?.[round];
      if (next && out.length < n) out.push(next);
    }
  }
  return out;
}

function firstName(profile: SessionProfile | null): string {
  const name = profile?.name?.trim();
  if (name) return name.split(/\s+/)[0];
  const local = (profile?.email || "").split("@")[0].split(/[._-]+/)[0] || "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

/** The project Forge builds right now (live plan steps), else the last one touched. */
function ResumeCard({ project, run, mediaToken }: { project: AppProject; run: ActiveRun | null; mediaToken: string | null }) {
  const { t } = useI18n();
  const stateLabel = useStateLabel();
  const steps = run?.steps ?? [];
  const running = steps.findIndex((s) => s.status === "running");
  const focus = running < 0 ? (run?.done ?? 0) : running;
  const from = Math.max(0, focus - 1);
  return (
    <article className="f-ov-card f-ov-resume">
      <Link className="shot" href={projectHref(project)} aria-label={t("apOpenNamed").replace("{name}", project.name)}>
        <ProjectThumb project={project} mediaToken={mediaToken} building={Boolean(run)} />
      </Link>
      <div className="info">
        {run ? <StatePill state="gen">{stateLabel("gen")}</StatePill> : <span className="f-eyebrow">{t("apResumeEyebrow")}</span>}
        <h2>{project.name}</h2>
        {run ? (
          steps.length ? (
            <div className="f-mini-steps">
              <div className="ok">
                <Glyph name="check" size="sm" />
                <span>{t("apPlanSteps").replace("{n}", String(steps.length))}</span>
              </div>
              {steps.slice(from, from + 3).map((step, i) => (
                <div
                  key={`${from + i}-${step.title}`}
                  className={step.status === "done" ? "ok" : step.status === "running" ? "run" : undefined}
                >
                  <Glyph name={step.status === "done" ? "check" : step.status === "running" ? "refresh" : "clock"} size="sm" />
                  <span>{step.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="f-note">{t(run.status === "running" ? "apResumeWorking" : "apResumeWaiting")}</p>
          )
        ) : (
          <p className="f-note">{t("apResumeLead")}</p>
        )}
        <div className="acts">
          <Button size="sm" icon={run ? "eye" : "arrow-right"} href={projectHref(project)}>
            {run ? t("apWatchBuild") : t("apResume")}
          </Button>
          <Button size="sm" variant="ghost" href={APP_ROUTES.projects}>
            {t("apAllProjects")}
          </Button>
        </div>
      </div>
    </article>
  );
}

/** FRODI left this cycle (no RODI amount here: the balance lives on the billing page). */
function FrodiOverviewCard() {
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const usage = frodiUsage(status);
  const plan = status?.plan ?? status?.entitlements?.plan_slug ?? null;
  const monthly = plan === "free";
  const days = daysUntil(usage?.resetsAt);
  return (
    <article className="f-ov-card">
      <div className="head">
        <h3>
          <Glyph name="zap" size="sm" />
          {monthly ? t("apFrodiMonth") : t("apFrodiWeek")}
        </h3>
        <Link href={APP_ROUTES.billing}>
          {t("apDetails")}
          <Glyph name="chevron-right" size="sm" />
        </Link>
      </div>
      {usage ? (
        <>
          <div className="f-usage-num">
            <b>{formatCount(usage.remaining, locale)}</b>
            <span>/ {formatCount(usage.grant, locale)}</span>
          </div>
          <StairsMeter
            value={usage.grant ? usage.remaining / usage.grant : 0}
            label={monthly ? t("uiFrodiLeftMonth") : t("uiFrodiLeftWeek")}
            valueText={`${formatCount(usage.remaining, locale)} / ${formatCount(usage.grant, locale)}`}
            steps={16}
          />
          <div className="f-kv">
            <span>{t("apRenewal")}</span>
            <b>{days == null ? "-" : days === 0 ? t("apToday") : t("apInDays").replace("{n}", String(days))}</b>
          </div>
          <div className="f-kv">
            <span>{t("apPlan")}</span>
            <b>{planDisplayName(plan) ?? t("uiPlanUnknown")}</b>
          </div>
        </>
      ) : (
        <>
          <p className="f-note">{t("apFrodiUnavailable")}</p>
          <Button size="sm" variant="ghost" href={APP_ROUTES.billing} style={{ width: "fit-content" }}>
            {t("apSeePlans")}
          </Button>
        </>
      )}
    </article>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const mediaToken = useMediaToken();
  const activity = useWorkspaceActivity();

  const [projects, setProjects] = useState<AppProject[]>([]);
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tileId, setTileId] = useState<HomeTileId>("blank");
  const [deckFormat, setDeckFormat] = useState<DeckRatio | undefined>(undefined);
  const [designSystemId, setDesignSystemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [toast, notify] = useToast(10000);

  const promptRef = useRef<ComposerHandle>(null);
  const tile = getTile(tileId);
  const busy = creating || Boolean(forkingId);

  const { actions, dialogs } = useProjectActions((change) => {
    if (change.removed) setProjects((prev) => prev.filter((p) => p.id !== change.removed));
    if (change.added) setProjects((prev) => [change.added as AppProject, ...prev]);
    if (change.patched) setProjects((prev) => prev.map((p) => (p.id === change.patched?.id ? { ...p, ...change.patched } : p)));
  });

  useEffect(() => {
    setMounted(true);
    const warmTpl = getCachedTemplates(locale);
    const warmProj = getCachedProjects(locale);
    if (warmTpl) setTemplates(warmTpl as GalleryTemplate[]);
    if (warmProj) {
      setProjects(warmProj as AppProject[]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint the warm cache once
  }, []);

  // Old tabbed-home links (?tab=projects, templates, design-systems) now have pages.
  useEffect(() => {
    const target = legacyTabTarget(searchParams.get("tab"));
    if (target) router.replace(target);
  }, [router, searchParams]);

  // ?prompt= prefills the composer (integration pages, links from the site).
  useEffect(() => {
    const seeded = searchParams.get("prompt");
    if (!seeded) return;
    setPrompt(seeded.slice(0, 4000));
    router.replace("/dashboard#create", { scroll: false });
    window.setTimeout(() => promptRef.current?.focus(), 60);
  }, [router, searchParams]);

  // "New project" (sidebar, bottom bar, the N key) lands on /dashboard#create.
  useEffect(() => {
    const focusCreate = () => {
      if (window.location.hash !== "#create") return;
      window.requestAnimationFrame(() => promptRef.current?.focus());
    };
    focusCreate();
    window.addEventListener("hashchange", focusCreate);
    return () => window.removeEventListener("hashchange", focusCreate);
  }, []);

  useEffect(() => {
    setProfile(getSessionSnapshot()?.profile ?? null);
    return subscribeSession((snap) => setProfile(snap?.profile ?? null));
  }, []);

  useEffect(
    () =>
      subscribeProjects(() => {
        const cached = getCachedProjects(locale);
        if (cached) setProjects(cached as AppProject[]);
      }),
    [locale],
  );

  useEffect(() => {
    if (busy) topProgressStart("dashboard-create");
    else topProgressDone("dashboard-create");
  }, [busy]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DESIGN_SYSTEM_KEY);
      if (stored) setDesignSystemId(stored);
    } catch {
      /* storage denied: start on "Aucun" */
    }
  }, []);

  useEffect(() => {
    return () => {
      files.forEach(revokePromptAttachment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const showDesignSystems = enabledKinds.includes("design_system");
  // Mine, shared with me and my teams', default first (GET /design-systems).
  const [dsList, setDsList] = useState<DesignSystemList | null>(null);
  const dsProjectCount = projects.filter((p) => kindOf(p) === "design_system").length;
  useEffect(() => {
    if (!showDesignSystems) return;
    let alive = true;
    void listDesignSystems()
      .then((list) => alive && setDsList(list))
      .catch(() => alive && setDsList(null));
    return () => {
      alive = false;
    };
  }, [showDesignSystems, dsProjectCount]);
  const designSystems: ComposerDesignSystem[] = useMemo(
    () =>
      dsList
        ? dsList.items.map((item) => ({ id: item.id, name: item.name, scope: item.scope, preview: item.preview }))
        : projects.filter((p) => kindOf(p) === "design_system").map((p) => ({ id: p.id, name: p.name })),
    [dsList, projects],
  );
  // With nothing remembered, the default design system is preselected.
  useEffect(() => {
    if (!dsList?.default_id) return;
    try {
      if (localStorage.getItem(DESIGN_SYSTEM_KEY)) return;
    } catch {
      /* storage denied: still preselect */
    }
    setDesignSystemId((current) => current ?? dsList.default_id);
  }, [dsList]);
  // A remembered design system that was deleted, or that the kind flag hides, is not sent.
  const effectiveDesignSystemId =
    showDesignSystems && designSystemId && designSystems.some((ds) => ds.id === designSystemId) ? designSystemId : null;

  function chooseDesignSystem(id: string | null) {
    setDesignSystemId(id);
    try {
      if (id) localStorage.setItem(DESIGN_SYSTEM_KEY, id);
      else localStorage.removeItem(DESIGN_SYSTEM_KEY);
    } catch {
      /* the choice still applies to this page */
    }
  }

  function quotaNotice(quota: Pick<ProjectQuota, "plan" | "limit">) {
    const limit = String(quota.limit ?? "");
    const plan = quota.plan ? quota.plan.charAt(0).toUpperCase() + quota.plan.slice(1) : "";
    if (plan) return t("projectQuota").replace("{plan}", plan).replace("{limit}", limit);
    return t("projectQuotaPlain").replace("{limit}", limit);
  }

  function promptLabels(): PromptLabels {
    return {
      importFiles: t("importFiles"),
      imageAttached: t("promptImageAttached"),
      assetAttached: t("promptSiteAsset"),
      mdSection: t("promptMdSection"),
      txtSection: t("promptTxtSection"),
      pdfSection: t("promptPdfSection"),
      pdfEmpty: t("promptPdfEmpty"),
    };
  }

  /** Credit and plan gates shared by every create path; false when blocked. */
  async function passGates(): Promise<boolean> {
    const gate = await ensureCanGenerate();
    if (gate === "no_rodi") {
      setError(t("createNeedsRodi"));
      return false;
    }
    if (gate === "no_key") {
      setError(t("createNeedsKey"));
      return false;
    }
    // Plan project cap: warn BEFORE the prompt runs.
    const quota = await fetchProjectQuota();
    if (!quota.can_create) {
      notify(quotaNotice(quota), "alert");
      return false;
    }
    return true;
  }

  function createFailed(err: unknown) {
    if (err instanceof PromptTooLongError) setError(t("promptTooLong"));
    else if (err instanceof ApiError && err.code === "project_quota_exceeded") notify(t("projectQuotaReached"), "alert");
    else if (err instanceof ApiError && err.code === "INSUFFICIENT_RODI") setError(t("createNeedsRodi"));
    else setError(err instanceof Error ? err.message : t("errorGeneric"));
  }

  function opened(project: CreatedProject) {
    prependProject(locale, project);
    invalidateThumbCache(project.id);
    void refreshWorkspaceActivity();
    router.replace(`/projects/${project.id}`);
  }

  async function createFromPrompt(raw: string, attachmentList: PromptAttachment[], platform: ProjectKindId, options: CreateOptions) {
    const trimmed = raw.trim();
    if (!trimmed && !attachmentList.length) return;
    setCreating(true);
    setError(null);
    try {
      if (!(await passGates())) {
        setCreating(false);
        return;
      }
      const project = await createProjectWithAttachments(
        trimmed,
        attachmentList,
        t("newProject"),
        promptLabels(),
        locale,
        platform,
        options,
      );
      attachmentList.forEach(revokePromptAttachment);
      setFiles([]);
      opened(project);
    } catch (err) {
      createFailed(err);
      setCreating(false);
    }
  }

  async function createWithTile(chosen: HomeTile, text: string) {
    const request = buildCreateRequest({
      tile: deckFormat && chosen.kind === "slides" ? { ...chosen, format: deckFormat } : chosen,
      text,
      enabled: enabledKinds,
      designSystemId: effectiveDesignSystemId,
      shortcutLabel: t(chosen.labelKey),
      shortcutTemplate: t("homeShortcutPrompt"),
    });
    await createFromPrompt(request.prompt, files, request.platform, request.options);
  }

  async function forkTemplate(tpl: GalleryTemplate) {
    if (busy) return;
    setForkingId(tpl.id);
    setError(null);
    try {
      if (!(await passGates())) {
        setForkingId(null);
        return;
      }
      opened(await forkProjectFromTemplate(tpl, { designSystemId: effectiveDesignSystemId }));
    } catch (err) {
      createFailed(err);
      setForkingId(null);
    }
  }

  async function startBlank(kind: ProjectKindId) {
    if (busy) return;
    setCreating(true);
    setError(null);
    try {
      if (!(await passGates())) {
        setCreating(false);
        return;
      }
      const chosen = tile.kind === kind ? tile : getTile(kind);
      const format = kind === "slides" ? (chosen.format ?? "16:9") : null;
      opened(await createBlankProject(t("newProject"), kind, { format, designSystemId: effectiveDesignSystemId }));
    } catch (err) {
      createFailed(err);
      setCreating(false);
    }
  }

  function selectTile(next: HomeTileId) {
    if (busy) return;
    setTileId(next);
    setDeckFormat(undefined);
  }

  function addFiles(list: FileList) {
    setFiles((prev) => {
      const { next, rejected } = mergePromptAttachments(prev, list);
      setFileError(rejected.length ? t("promptFileTypeError") : null);
      return next;
    });
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePromptAttachment(target);
      return prev.filter((item) => item.id !== id);
    });
    setFileError(null);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    async function boot() {
      topProgressStart("dashboard-boot");
      try {
        // A template or a prompt chosen before signing in (landing) runs now.
        const pendingTpl = sessionStorage.getItem(PENDING_TEMPLATE_KEY);
        if (pendingTpl?.trim()) {
          sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
          const tpls = await ensureTemplates(locale, { force: true });
          setTemplates(tpls as GalleryTemplate[]);
          const match = tpls.find((x) => x.id === pendingTpl.trim());
          if (match) {
            await forkTemplate(match as GalleryTemplate);
            return;
          }
        }
        const pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
        if (pending?.trim()) {
          sessionStorage.removeItem(PENDING_PROMPT_KEY);
          const pendingPlatform = readPendingPlatform();
          const pendingOptions = readPendingCreateOptions();
          clearPendingPlatform();
          clearPendingCreateOptions();
          const restored = await restorePendingFilesAsAttachments();
          const restoredAttachments = restored
            .map((file) => createPromptAttachment(file))
            .filter((item): item is NonNullable<ReturnType<typeof createPromptAttachment>> => item !== null);
          await createFromPrompt(pending.trim(), restoredAttachments, pendingPlatform, pendingOptions);
          return;
        }

        const [tpls, list] = await Promise.all([ensureTemplates(locale), ensureProjects(locale)]);
        setTemplates(tpls as GalleryTemplate[]);
        setProjects(list as AppProject[]);
        setLoading(false);

        // Always re-read projects from the server (a create used to leave a
        // cache holding only the new project).
        void Promise.all([ensureProjects(locale, { force: true }), refreshTemplatesIfStale(locale)]).then(
          ([freshProjects, freshTemplates]) => {
            setProjects(freshProjects as AppProject[]);
            setTemplates(freshTemplates as GalleryTemplate[]);
          },
        );
      } catch (err) {
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) return;
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      } finally {
        setLoading(false);
        topProgressDone("dashboard-boot");
      }
    }

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount/locale
  }, [locale, router, t]);

  const suggestionKind = tile.kind ?? "web";
  const suggestions =
    suggestionKind === "web" || suggestionKind === "mobile"
      ? (suggestionKind === "mobile" ? MOBILE_SUGGESTIONS : WEB_SUGGESTIONS).map((key) => t(key))
      : [];
  const gateError = error === t("createNeedsKey") || error === t("createNeedsRodi") ? error : null;

  const sorted = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at)),
    [projects],
  );
  const run = activity.active.find((r) => projects.some((p) => p.id === r.project_id)) ?? null;
  const resumeProject = run ? (projects.find((p) => p.id === run.project_id) ?? null) : (sorted[0] ?? null);
  const recent = sorted.filter((p) => p.id !== resumeProject?.id).slice(0, 3);
  const picks = useMemo(() => pickTemplates(templates, enabledKinds), [templates, enabledKinds]);
  const name = mounted ? firstName(profile) : "";
  const news = NEWS.filter((n) => enabledKinds.includes(n.kind));

  return (
    <AppShell active="home" title={t("uiNavHome")}>
      <VerifyEmailBanner />
      {toast}
      <section className="f-ov-hero" id="create">
        <HeroBackdrop />
        <h1>
          {name ? t("apHello").replace("{name}", name) : t("apHelloAnon")}
          <br />
          <span className="f-hl">{t("apHeroLine")}</span>
        </h1>
        <p className="sub">{t("apHeroSub")}</p>
        <div className="f-ov-composer">
          <Composer
            ref={promptRef}
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void createWithTile(tile, prompt)}
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            tileId={tileId}
            onTileChange={selectTile}
            enabledKinds={enabledKinds}
            deckFormat={deckFormat}
            onDeckFormatChange={setDeckFormat}
            manageDesignSystemsHref={`${APP_ROUTES.projects}?kind=design_system`}
            kindsDefaultOpen={false}
            designSystems={designSystems}
            designSystemId={effectiveDesignSystemId}
            onDesignSystemChange={chooseDesignSystem}
            showDesignSystems={showDesignSystems}
            busy={busy}
            suggestions={suggestions}
            upgradeHref={APP_ROUTES.billing}
            alerts={
              fileError || error ? (
                <>
                  {fileError ? <p className="f-error">{fileError}</p> : null}
                  {gateError ? (
                    <p className="f-error" role="alert">
                      {gateError}{" "}
                      {gateError === t("createNeedsKey") ? (
                        <Link href={`${APP_ROUTES.settings}#rodiumai`}>{t("openSettings")}</Link>
                      ) : (
                        <a href={rodiumRechargeUrl(profile?.rodium_sub)} target="_blank" rel="noreferrer">
                          {t("rechargeRodi")}
                        </a>
                      )}
                    </p>
                  ) : error ? (
                    <p className="f-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </>
              ) : null
            }
          />
          <div className="f-ov-under">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Glyph name="github" size="sm" />
              {t("apOpenSource")}
            </a>
          </div>
        </div>
      </section>
      <TeamInviteNotice />

      <div className="f-ov-grid">
        {resumeProject ? (
          <ResumeCard project={resumeProject} run={run} mediaToken={mediaToken} />
        ) : (
          <article className="f-ov-card f-ov-resume" style={{ display: "flex", padding: 24 }}>
            <div className="info" style={{ padding: 0 }}>
              <span className="f-eyebrow">{t("apFirstEyebrow")}</span>
              <h2>{loading ? t("loading") : t("apFirstTitle")}</h2>
              <p className="f-note">{t("apFirstLead")}</p>
              <div className="acts">
                <Button size="sm" icon="layers" href={APP_ROUTES.templates}>
                  {t("apBrowseTemplates")}
                </Button>
              </div>
            </div>
          </article>
        )}
        <FrodiOverviewCard />
      </div>

      {recent.length ? (
        <>
          <div className="f-section-title">
            <h2>{t("apRecentProjects")}</h2>
            <Button variant="ghost" size="sm" iconEnd="arrow-right" href={APP_ROUTES.projects}>
              {t("apSeeAll")}
            </Button>
          </div>
          <div className="f-pgrid">
            {recent.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                state={projectState(project, activity.states)}
                actions={actions}
                mediaToken={mediaToken}
                mounted={mounted}
                index={i}
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="f-section-title">
        <h2>{t("apStartFromKind")}</h2>
      </div>
      <div className="f-quick-kinds">
        {enabledKinds.map((kind) => {
          const style = kindStyle(kind);
          return (
            <button key={kind} type="button" disabled={busy} onClick={() => void startBlank(kind)}>
              <span className="k" style={{ background: style.color }}>
                <Glyph name={style.glyph} />
              </span>
              <b>{t(style.labelKey)}</b>
              <small>{t(KIND_HINTS[kind])}</small>
            </button>
          );
        })}
      </div>

      {picks.length ? (
        <>
          <div className="f-section-title">
            <h2>{t("apTemplatesForYou")}</h2>
            <Button variant="ghost" size="sm" iconEnd="arrow-right" href={APP_ROUTES.templates}>
              {t("apAllTemplates")}
            </Button>
          </div>
          <div className="f-paper f-paper-band">
            <div className="f-tgrid">
              {picks.map((tpl, i) => (
                <TemplateCard key={tpl.id} template={tpl} index={i} href={`${APP_ROUTES.templates}/${encodeURIComponent(tpl.id)}`} />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {news.length ? (
        <>
          <div className="f-section-title">
            <h2>{t("apWhatsNew")}</h2>
          </div>
          <div className="f-ov-grid" style={{ marginTop: 0 }}>
            {news.map((n) => (
              <Link key={n.kind} className="f-ov-card f-news-card" href={`${APP_ROUTES.templates}?kind=${n.kind}`}>
                <Badge tone="new" style={{ width: "fit-content" }}>
                  <Glyph name="sparkles" size="xs" />
                  {t("uiNew")}
                </Badge>
                <h3>
                  <Glyph name={n.glyph} />
                  {t(n.title)}
                </h3>
                <p>{t(n.body)}</p>
                <span className="try">
                  {t("apTryIt")}
                  <Glyph name="arrow-right" size="sm" />
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      {dialogs}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
