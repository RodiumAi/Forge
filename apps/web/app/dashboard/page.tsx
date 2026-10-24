"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { TriangleAlert, X } from "lucide-react";

import "@/components/home/home.css";

import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { ShareProjectModal } from "@/components/builder/ShareProjectModal";
import { CreatePrompt, type CreatePromptHandle } from "@/components/home/CreatePrompt";
import type { DesignSystemOption } from "@/components/home/DesignSystemPicker";
import { AnnouncementBanner, DeleteDialog, RenameDialog } from "@/components/home/HomeDialogs";
import { HomeTabs, type HomeTab } from "@/components/home/HomeTabs";
import { buildCreateRequest, getTile, type HomeTile, type HomeTileId } from "@/components/home/home-kinds";
import { KindGrid } from "@/components/home/KindGrid";
import type { ProjectActions } from "@/components/home/ProjectCard";
import { kindOf, type HomeProject } from "@/components/home/projects";
import { useFavorites, useLastOpened } from "@/components/home/use-home-prefs";
import { HomeLayout } from "@/components/HomeLayout";
import { invalidateThumbCache } from "@/components/SiteThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { TeamInviteNotice } from "@/components/TeamInviteNotice";
import { api, ApiError, getToken } from "@/lib/api";
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
  type ProjectQuota,
} from "@/lib/create-project";
import { shareSeatLimit, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import {
  ensureProjects,
  ensureTemplates,
  getCachedProjects,
  getCachedTemplates,
  prependProject,
  refreshTemplatesIfStale,
  removeProject,
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

const DESIGN_SYSTEM_KEY = "forge_home_design_system";

/** `?tab=` values, old ones included (mine, recent) so existing links keep working. */
function tabFromParam(raw: string | null): HomeTab | null {
  if (raw === "templates") return "templates";
  if (raw === "design-systems" || raw === "design_systems") return "design_systems";
  if (raw === "projects" || raw === "mine" || raw === "recent") return "projects";
  return null;
}

function paramFromTab(tab: HomeTab): string {
  if (tab === "templates") return "/dashboard?tab=templates";
  if (tab === "design_systems") return "/dashboard?tab=design-systems";
  return "/dashboard";
}

const WEB_SUGGESTIONS = ["promptSuggest1", "promptSuggest2", "promptSuggest3", "promptSuggest4", "promptSuggest5"] as const;
const MOBILE_SUGGESTIONS = [
  "promptSuggestMobile1",
  "promptSuggestMobile2",
  "promptSuggestMobile3",
  "promptSuggestMobile4",
  "promptSuggestMobile5",
] as const;

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const forge = useForgeStatus();
  const mediaToken = useMediaToken();

  const [projects, setProjects] = useState<HomeProject[]>([]);
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tileId, setTileId] = useState<HomeTileId>("blank");
  const [designSystemId, setDesignSystemId] = useState<string | null>(null);
  const [tab, setTab] = useState<HomeTab>(() => tabFromParam(searchParams.get("tab")) ?? "projects");
  const [galleryKind, setGalleryKind] = useState<ProjectKindId>("web");
  const [galleryQuery, setGalleryQuery] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [renaming, setRenaming] = useState<HomeProject | null>(null);
  const [deleting, setDeleting] = useState<HomeProject | null>(null);
  const [sharing, setSharing] = useState<HomeProject | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(() =>
    typeof window !== "undefined" ? (getSessionSnapshot()?.profile ?? null) : null,
  );

  const promptRef = useRef<CreatePromptHandle>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const account = profile?.email ?? null;
  const favorites = useFavorites(account);
  const lastOpened = useLastOpened(account);
  const tile = getTile(tileId);
  const busy = creating || Boolean(forkingId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setProfile(getSessionSnapshot()?.profile ?? null);
    return subscribeSession((snap) => setProfile(snap?.profile ?? null));
  }, []);

  useEffect(() => {
    const next = tabFromParam(searchParams.get("tab"));
    if (next) setTab(next);
  }, [searchParams]);

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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 10000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const designSystems: DesignSystemOption[] = useMemo(
    () => projects.filter((p) => kindOf(p) === "design_system").map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );
  const showDesignSystems = enabledKinds.includes("design_system");
  // A remembered design system that was deleted, or that the kind flag hides,
  // is not sent: the create would fail on it.
  const effectiveDesignSystemId =
    showDesignSystems && designSystemId && designSystems.some((ds) => ds.id === designSystemId)
      ? designSystemId
      : null;

  function chooseDesignSystem(id: string | null) {
    setDesignSystemId(id);
    try {
      if (id) localStorage.setItem(DESIGN_SYSTEM_KEY, id);
      else localStorage.removeItem(DESIGN_SYSTEM_KEY);
    } catch {
      /* the choice still applies to this page */
    }
  }

  function selectTab(next: HomeTab) {
    setTab(next);
    router.replace(paramFromTab(next));
  }

  function pushNotice(text: string) {
    setNotice({ text, id: Date.now() });
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
    // Plan project cap: warn BEFORE the prompt runs (a Free user at 1 project
    // sees the upgrade prompt here instead of a failed create).
    const quota = await fetchProjectQuota();
    if (!quota.can_create) {
      pushNotice(quotaNotice(quota));
      return false;
    }
    return true;
  }

  function createFailed(err: unknown) {
    if (err instanceof PromptTooLongError) setError(t("promptTooLong"));
    else if (err instanceof ApiError && err.code === "project_quota_exceeded") pushNotice(t("projectQuotaReached"));
    else if (err instanceof ApiError && err.code === "INSUFFICIENT_RODI") setError(t("createNeedsRodi"));
    else setError(err instanceof Error ? err.message : t("errorGeneric"));
  }

  function opened(project: CreatedProject) {
    prependProject(locale, project);
    invalidateThumbCache(project.id);
    lastOpened.record(project.id);
    router.replace(`/projects/${project.id}`);
  }

  async function createFromPrompt(
    raw: string,
    attachmentList: PromptAttachment[],
    platform: ProjectKindId,
    options: CreateOptions,
  ) {
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
      tile: chosen,
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
      opened(
        await createBlankProject(t("newProject"), kind, { format, designSystemId: effectiveDesignSystemId }),
      );
    } catch (err) {
      createFailed(err);
      setCreating(false);
    }
  }

  function onSelectTile(next: HomeTile) {
    if (busy) return;
    setTileId(next.id);
    if (prompt.trim() || files.length) {
      // With a request typed, a tile launches it right away.
      void createWithTile(next, prompt);
      return;
    }
    if (!next.kind) {
      promptRef.current?.focus();
      return;
    }
    // Without text: the gallery of that kind (shortcuts seed its search).
    setGalleryKind(next.kind);
    setGalleryQuery(next.galleryQuery);
    selectTab("templates");
    window.requestAnimationFrame(() => tabsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
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

        // Paint from the session cache at once (no spinner when warm).
        const warmTpl = getCachedTemplates(locale);
        const warmProj = getCachedProjects(locale);
        if (warmTpl) setTemplates(warmTpl as GalleryTemplate[]);
        if (warmProj) {
          setProjects(warmProj as HomeProject[]);
          setLoading(false);
        }

        const [tpls, list] = await Promise.all([ensureTemplates(locale), ensureProjects(locale)]);
        setTemplates(tpls as GalleryTemplate[]);
        setProjects(list as HomeProject[]);

        // Onboarding: a new account lands on the templates.
        if ((list as HomeProject[]).length === 0 && !searchParams.get("tab")) {
          setTab("templates");
          router.replace("/dashboard?tab=templates");
        }

        // Always re-read projects from the server: a create used to replace the
        // cached list with the new project alone and mark it fresh.
        void Promise.all([ensureProjects(locale, { force: true }), refreshTemplatesIfStale(locale)]).then(
          ([freshProjects, freshTemplates]) => {
            setProjects(freshProjects as HomeProject[]);
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

  const patchProject = useCallback((id: string, patch: Partial<HomeProject>) => {
    setProjects((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const actions: ProjectActions = {
    open: (project) => {
      lastOpened.record(project.id);
      router.push(`/projects/${project.id}`);
    },
    rename: (project) => setRenaming(project),
    share: (project) => setSharing(project),
    remove: (project) => setDeleting(project),
    isFavorite: favorites.isFavorite,
    toggleFavorite: favorites.toggle,
    lastOpened: lastOpened.get,
    onThumbPersisted: (id, info) =>
      patchProject(id, { has_thumbnail: true, ...(info?.updated_at ? { updated_at: info.updated_at } : {}) }),
  };

  const suggestionKind = tile.kind ?? "web";
  const suggestions =
    suggestionKind === "web" || suggestionKind === "mobile"
      ? (suggestionKind === "mobile" ? MOBILE_SUGGESTIONS : WEB_SUGGESTIONS).map((key) => t(key))
      : [];
  const gateError = error === t("createNeedsKey") || error === t("createNeedsRodi") ? error : null;
  const showAnnouncement = enabledKinds.some((kind) => kind !== "web" && kind !== "mobile");

  return (
    <HomeLayout activeNav={tab === "templates" ? "templates" : "projects"}>
      {notice && typeof document !== "undefined"
        ? createPortal(
            <div key={notice.id} className="home-push-toast" role="alert">
              <TriangleAlert className="home-push-toast-icon" aria-hidden />
              <p>{notice.text}</p>
              <button
                type="button"
                className="home-push-toast-close"
                aria-label={t("frodiUsageDismiss")}
                onClick={() => setNotice(null)}
              >
                <X aria-hidden />
              </button>
            </div>,
            document.body,
          )
        : null}

      <div className="fdh">
        {showAnnouncement ? <AnnouncementBanner /> : null}
        <section className="fdh-hero">
          <h1 className="fdh-title">{t("homeTitle")}</h1>
          <TeamInviteNotice />
          <CreatePrompt
            ref={promptRef}
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void createWithTile(tile, prompt)}
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            tile={tile.kind ? tile : null}
            onClearTile={() => setTileId("blank")}
            designSystems={designSystems}
            designSystemId={effectiveDesignSystemId}
            onDesignSystemChange={chooseDesignSystem}
            showDesignSystems={showDesignSystems}
            busy={busy}
            suggestions={suggestions}
            alerts={
              <>
                {fileError ? <p className="landing-file-error">{fileError}</p> : null}
                {gateError ? (
                  <p className="landing-file-error" role="alert">
                    {gateError}{" "}
                    {gateError === t("createNeedsKey") ? (
                      <Link href="/settings?tab=generation">{t("openSettings")}</Link>
                    ) : (
                      <a href={rodiumRechargeUrl(profile?.rodium_sub)} target="_blank" rel="noreferrer">
                        {t("rechargeRodi")}
                      </a>
                    )}
                  </p>
                ) : null}
              </>
            }
          />
          <KindGrid enabledKinds={enabledKinds} selected={tileId} onSelect={onSelectTile} disabled={busy} />
        </section>

        <div ref={tabsRef}>
          <HomeTabs
            tab={tab}
            onTabChange={selectTab}
            enabledKinds={enabledKinds}
            projects={projects}
            loading={loading}
            error={gateError ? null : error}
            actions={actions}
            favorites={favorites.ids}
            mediaToken={mediaToken}
            mounted={mounted}
            templates={templates}
            galleryKind={galleryKind}
            onGalleryKindChange={(kind) => {
              setGalleryKind(kind);
              setGalleryQuery(undefined);
            }}
            galleryQuery={galleryQuery}
            forkingId={forkingId}
            onFork={(tpl) => void forkTemplate(tpl)}
            onStartBlank={(kind) => void startBlank(kind)}
            onNewDesignSystem={() => {
              setTileId("design_system");
              promptRef.current?.focus();
            }}
            busy={busy}
          />
        </div>
      </div>

      {renaming ? (
        <RenameDialog
          name={renaming.name}
          onCancel={() => setRenaming(null)}
          onSave={async (name) => {
            const updated = await api<HomeProject>(`/projects/${renaming.id}`, {
              method: "PATCH",
              body: JSON.stringify({ name }),
            });
            patchProject(renaming.id, { name: updated?.name ?? name, slug: updated?.slug ?? renaming.slug });
            setRenaming(null);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onDelete={async () => {
            await api(`/projects/${deleting.id}`, { method: "DELETE" });
            removeProject(locale, deleting.id);
            setProjects((prev) => prev.filter((row) => row.id !== deleting.id));
            if (designSystemId === deleting.id) chooseDesignSystem(null);
            setDeleting(null);
          }}
        />
      ) : null}
      {sharing ? (
        <ShareProjectModal
          projectId={sharing.id}
          projectName={sharing.name}
          seatLimit={shareSeatLimit(forge)}
          onClose={() => setSharing(null)}
        />
      ) : null}
    </HomeLayout>
  );
}

function DashboardSuspenseFallback() {
  return (
    <div className="home-grid home-grid-3" style={{ padding: "1.5rem" }} aria-busy="true">
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
  );
}

export default function DashboardPage() {
  return (
    <>
      <VerifyEmailBanner />
      <Suspense fallback={<DashboardSuspenseFallback />}>
        <DashboardInner />
      </Suspense>
    </>
  );
}
