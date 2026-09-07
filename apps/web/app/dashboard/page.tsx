"use client";

import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { apiBase, getToken } from "@/lib/api";
import { useMediaToken } from "@/lib/media-token";
import { projectThumbnailUrl } from "@/lib/project-thumbnail";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { HomeLayout } from "@/components/HomeLayout";
import { PromptFileChips } from "@/components/PromptFileChips";
import { SiteThumb, invalidateThumbCache } from "@/components/SiteThumb";
import { GalleryTemplate } from "@/components/TemplateGallery";
import { Icon } from "@/components/ui/icon";
import {
  PENDING_PROMPT_KEY,
  PENDING_TEMPLATE_KEY,
  createProjectWithAttachments,
  ensureCanGenerate,
  forkProjectFromTemplate,
  restorePendingFilesAsAttachments,
} from "@/lib/create-project";
import {
  ensureProjects,
  ensureTemplates,
  getCachedProjects,
  getCachedTemplates,
  invalidateProjectsCache,
  prependProject,
  refreshProjectsIfStale,
  refreshTemplatesIfStale,
} from "@/lib/lists-cache";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  PROMPT_FILE_ACCEPT,
  PromptAttachment,
  createPromptAttachment,
  mergePromptAttachments,
  revokePromptAttachment,
  type PromptLabels,
} from "@/lib/prompt-attachments";
import { PROMPT_MAX_CHARS, PromptTooLongError } from "@/lib/constants/prompt";

type Project = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at?: string;
  template_id?: string | null;
  preview_running?: boolean;
  public_url?: string | null;
  has_thumbnail?: boolean;
};

type Tab = "mine" | "recent" | "templates";

function formatProjectMeta(iso: string, locale: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr" : "en", { numeric: "auto" });
    const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
    return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
  } catch {
    return date.toLocaleDateString(locale);
  }
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("mine");
  // Render the grid in windows: mounting every card at once instantiates a
  // ResizeObserver + IntersectionObserver per SiteThumb and a large DOM, which
  // is heavy for accounts with many projects. "Load more" reveals the rest.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "templates") setTab("templates");
    else if (raw === "recent") setTab("recent");
    else if (raw === "mine" || raw === "projects") setTab("mine");
  }, [searchParams]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 140)}px`;
  }, [prompt]);

  useEffect(() => {
    if (creating || forkingId) topProgressStart("dashboard-create");
    else topProgressDone("dashboard-create");
  }, [creating, forkingId]);

  // Filtering/switching tabs changes which projects show — reset the window so
  // we never keep a large render (and its thumbnails) mounted after a filter.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, tab]);

  useEffect(() => {
    return () => {
      files.forEach(revokePromptAttachment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

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
          const restored = await restorePendingFilesAsAttachments();
          const restoredAttachments = restored
            .map((file) => createPromptAttachment(file))
            .filter((item): item is NonNullable<ReturnType<typeof createPromptAttachment>> => item !== null);
          await createFromPrompt(pending.trim(), restoredAttachments);
          return;
        }

        // Paint from session cache immediately (no spinner when warm).
        const warmTpl = getCachedTemplates(locale);
        const warmProj = getCachedProjects(locale);
        if (warmTpl) setTemplates(warmTpl as GalleryTemplate[]);
        if (warmProj) {
          setProjects(warmProj as Project[]);
          setLoading(false);
        }

        const [tpls, list] = await Promise.all([
          ensureTemplates(locale),
          ensureProjects(locale),
        ]);
        setTemplates(tpls as GalleryTemplate[]);
        setProjects(list as Project[]);

        if ((list as Project[]).length === 0 && searchParams.get("tab") !== "templates") {
          setTab("templates");
          router.replace("/dashboard?tab=templates");
        }

        // Soft-stale: finish background refresh when it completes.
        void Promise.all([
          refreshProjectsIfStale(locale),
          refreshTemplatesIfStale(locale),
        ]).then(([freshProjects, freshTemplates]) => {
          setProjects(freshProjects as Project[]);
          setTemplates(freshTemplates as GalleryTemplate[]);
        });
      } catch (err) {
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) {
          return;
        }
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      } finally {
        setLoading(false);
        topProgressDone("dashboard-boot");
      }
    }

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount/locale
  }, [locale, router, t]);

  function selectTab(next: Tab) {
    setTab(next);
    setQuery("");
    if (next === "templates") {
      router.replace("/dashboard?tab=templates");
    } else if (next === "recent") {
      router.replace("/dashboard?tab=recent");
    } else {
      router.replace("/dashboard");
    }
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

  async function createFromPrompt(raw: string, attachmentList: PromptAttachment[] = files) {
    const trimmed = raw.trim();
    if (!trimmed && !attachmentList.length) return;
    setCreating(true);
    setError(null);
    try {
      const gate = await ensureCanGenerate();
      if (gate === "no_key") {
        setError(t("createNeedsKey"));
        setCreating(false);
        return;
      }
      const project = await createProjectWithAttachments(
        trimmed,
        attachmentList,
        t("newProject"),
        promptLabels(),
        locale,
      );
      invalidateProjectsCache();
      prependProject(locale, project);
      invalidateThumbCache(project.id);
      attachmentList.forEach(revokePromptAttachment);
      setFiles([]);
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof PromptTooLongError) {
        setError(t("promptTooLong"));
      } else {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
      setCreating(false);
    }
  }

  async function forkTemplate(tpl: GalleryTemplate) {
    if (creating || forkingId) return;
    setForkingId(tpl.id);
    setError(null);
    try {
      const gate = await ensureCanGenerate();
      if (gate === "no_key") {
        setError(t("createNeedsKey"));
        setForkingId(null);
        return;
      }
      const project = await forkProjectFromTemplate(tpl);
      invalidateProjectsCache();
      prependProject(locale, project);
      invalidateThumbCache(project.id);
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setForkingId(null);
    }
  }

  async function submitPrompt() {
    if (creating) return;
    if (!prompt.trim() && !files.length) return;
    await createFromPrompt(prompt);
  }

  async function onPromptSubmit(e: FormEvent) {
    e.preventDefault();
    await submitPrompt();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt();
    }
  }

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setFiles((prev) => {
      const { next, rejected } = mergePromptAttachments(prev, list);
      setFileError(rejected.length ? t("promptFileTypeError") : null);
      return next;
    });
    e.target.value = "";
  }

  function onPromptDrop(e: React.DragEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;
    if (e.dataTransfer.files?.length) {
      setFiles((prev) => {
        const { next, rejected } = mergePromptAttachments(prev, e.dataTransfer.files);
        setFileError(rejected.length ? t("promptFileTypeError") : null);
        return next;
      });
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePromptAttachment(target);
      return prev.filter((item) => item.id !== id);
    });
    setFileError(null);
  }

  const filteredProjects = useMemo(() => {
    const list = [...projects];
    if (tab === "recent") {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [projects, query, tab]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (tpl) =>
        tpl.title.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, query]);

  const canSubmit = Boolean(prompt.trim() || files.length) && !creating;
  const showTemplates = tab === "templates";
  // Subscribed rather than read once: the token is fetched asynchronously, and
  // without a re-render every thumbnail would stay on its placeholder until
  // something unrelated happened to re-render the page.
  const mediaToken = useMediaToken();

  function projectThumb(p: Project) {
    // Prefer the persisted JPEG from the API. Old projects without a file
    // backfill once via live draft capture, then PUT so the next visit is cheap.
    if (p.has_thumbnail) {
      const imageSrc = projectThumbnailUrl(p.id, p.updated_at);
      if (imageSrc) {
        return {
          imageSrc,
          frameSrc: null as string | null,
          src: null as string | null,
          authPath: null as string | null,
          persistProjectId: null as string | null,
        };
      }
    }
    const token = mediaToken;
    if (token) {
      const base = apiBase().replace(/\/$/, "");
      const parent = encodeURIComponent(window.location.origin);
      return {
        imageSrc: null as string | null,
        frameSrc: `${base}/projects/${p.id}/draft?access_token=${encodeURIComponent(token)}&parent_origin=${parent}&thumb=1`,
        src: null as string | null,
        authPath: null as string | null,
        persistProjectId: p.id,
      };
    }
    if (p.template_id) {
      return {
        imageSrc: null,
        frameSrc: null,
        src: `/templates/${p.template_id}/preview`,
        authPath: null as string | null,
        persistProjectId: null,
      };
    }
    return {
      imageSrc: null,
      frameSrc: null,
      src: null,
      authPath: `/projects/${p.id}/card-preview`,
      persistProjectId: null,
    };
  }

  return (
    <HomeLayout activeNav={showTemplates ? "templates" : "projects"}>
      <section className={`home-hero${showTemplates ? " is-compact" : ""}`}>
        <h1 className="home-greeting">{t("dashboardGreeting")}</h1>

        <form
          className="landing-prompt home-prompt"
          onSubmit={onPromptSubmit}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onPromptDrop}
        >
          <PromptFileChips items={files} onRemove={removeFile} />
          {fileError && <p className="landing-file-error">{fileError}</p>}
          {error && error === t("createNeedsKey") && (
            <p className="landing-file-error" role="alert">
              {error} <Link href="/settings?tab=generation">{t("openSettings")}</Link>
            </p>
          )}
          {prompt.length > PROMPT_MAX_CHARS - 1000 ? (
            <p
              className={`prompt-char-count${prompt.length >= PROMPT_MAX_CHARS ? " at-limit" : ""}`}
              aria-live="polite"
            >
              {prompt.length.toLocaleString()} / {PROMPT_MAX_CHARS.toLocaleString()}
            </p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={prompt}
            maxLength={PROMPT_MAX_CHARS}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("promptPlaceholder")}
            aria-label={t("promptAria")}
            rows={3}
            disabled={creating}
          />
          <div className="landing-prompt-actions">
            <input
              ref={fileInputRef}
              type="file"
              className="landing-import-input"
              multiple
              accept={PROMPT_FILE_ACCEPT}
              onChange={onFilesSelected}
            />
            <button
              type="button"
              className="landing-plus"
              aria-label={t("importAria")}
              onClick={() => fileInputRef.current?.click()}
              disabled={creating}
            >
              <Icon icon={Plus} />
            </button>
            <button
              type="submit"
              className="landing-create"
              disabled={!canSubmit}
              title={!canSubmit ? t("createNeedPrompt") : undefined}
            >
              {creating ? t("loading") : t("create")}
            </button>
          </div>
        </form>
      </section>

      <section className="home-panel">
        <div className="home-panel-toolbar">
          <label className="home-search">
            <Icon icon={Search} className="ui-icon-sm" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={showTemplates ? t("searchTemplates") : t("searchProjects")}
            />
          </label>

          <div className="home-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={tab === "mine" ? "active" : ""}
              aria-selected={tab === "mine"}
              onClick={() => selectTab("mine")}
            >
              {t("tabMyProjects")}
            </button>
            <button
              type="button"
              role="tab"
              className={tab === "recent" ? "active" : ""}
              aria-selected={tab === "recent"}
              onClick={() => selectTab("recent")}
            >
              {t("tabRecent")}
            </button>
            <button
              type="button"
              role="tab"
              className={tab === "templates" ? "active" : ""}
              aria-selected={tab === "templates"}
              onClick={() => selectTab("templates")}
            >
              {t("tabTemplates")}
            </button>
          </div>
        </div>

        {error && error !== t("createNeedsKey") && (
          <p className="error home-panel-error">{error}</p>
        )}

        {loading ? (
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
        ) : showTemplates ? (
          <>
            <div className="home-grid home-grid-3">
              {filteredTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="home-card"
                  disabled={Boolean(forkingId) || creating}
                  onClick={() => void forkTemplate(tpl)}
                >
                  <SiteThumb
                    src={tpl.preview_url || `/templates/${tpl.id}/preview`}
                    viewportWidth={480}
                    viewportHeight={300}
                    title={tpl.title}
                    className="home-card-thumb"
                  />
                  <div className="home-card-body">
                    <strong>{tpl.title}</strong>
                    <span>
                      {forkingId === tpl.id ? t("forkingTemplate") : tpl.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {filteredTemplates.length === 0 && (
              <p className="home-panel-empty">{t("noTemplates")}</p>
            )}
          </>
        ) : (
          <>
            <div className="home-grid home-grid-3">
              {filteredProjects.slice(0, visibleCount).map((p) => {
                const thumb = projectThumb(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="home-card"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <SiteThumb
                      imageSrc={thumb.imageSrc}
                      frameSrc={thumb.frameSrc}
                      src={thumb.src}
                      authPath={thumb.authPath}
                      persistProjectId={thumb.persistProjectId}
                      onThumbPersisted={(info) => {
                        setProjects((prev) =>
                          prev.map((row) =>
                            row.id === p.id
                              ? {
                                  ...row,
                                  has_thumbnail: true,
                                  updated_at: info?.updated_at || row.updated_at,
                                }
                              : row,
                          ),
                        );
                      }}
                      cacheKey={`${p.id}:${p.updated_at || p.created_at}`}
                      title={p.name}
                      className="home-card-thumb"
                    />
                    <div className="home-card-body">
                      <strong title={p.name}>{p.name}</strong>
                      <span title={p.slug}>
                        {mounted ? formatProjectMeta(p.updated_at || p.created_at, locale) : "…"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredProjects.length === 0 && (
              <p className="home-panel-empty">{t("noProjects")}</p>
            )}
            {filteredProjects.length > visibleCount && (
              <div className="home-panel-more">
                <button
                  type="button"
                  className="home-load-more"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  {t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </section>
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
