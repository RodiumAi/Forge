"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { LandingReveal } from "@/components/landing/LandingReveal";
import {
  GithubMark,
  LandingSocialLinks,
} from "@/components/landing/LandingSocialLinks";
import { PromptFileChips } from "@/components/PromptFileChips";
import { SiteThumb } from "@/components/SiteThumb";
import { GalleryTemplate } from "@/components/TemplateGallery";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Icon } from "@/components/ui/icon";
import { getToken } from "@/lib/api";
import {
  FORGE_CONTRIBUTE,
  RODIUM_LEGAL,
  RODIUM_SITE,
} from "@/lib/constants/rodium-links";
import {
  PENDING_PROMPT_KEY,
  PENDING_TEMPLATE_KEY,
  createProjectWithAttachments,
  ensureCanGenerate,
  forkProjectFromTemplate,
  stashPendingFiles,
} from "@/lib/create-project";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";
import {
  ensureTemplates,
  getCachedTemplates,
  invalidateProjectsCache,
  prependProject,
  refreshTemplatesIfStale,
} from "@/lib/lists-cache";
import {
  LocalPromptAttachment,
  PROMPT_FILE_ACCEPT,
  PromptAttachment,
  mergePromptAttachments,
  revokePromptAttachment,
  type PromptLabels,
} from "@/lib/prompt-attachments";
import { ArrowUp, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type PromptBoxProps = {
  compact?: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  files: PromptAttachment[];
  fileError: string | null;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFilesSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  onPromptDrop: (e: React.DragEvent<HTMLFormElement>) => void;
  removeFile: (id: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

function LandingPromptBox({
  compact,
  prompt,
  setPrompt,
  files,
  fileError,
  error,
  submitting,
  canSubmit,
  onSubmit,
  onKeyDown,
  onFilesSelected,
  onPromptDrop,
  removeFile,
  textareaRef,
  fileInputRef,
}: PromptBoxProps) {
  const { t } = useI18n();
  return (
    <form
      className={`lp-prompt${compact ? " lp-prompt-compact" : ""}`}
      onSubmit={onSubmit}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onPromptDrop}
    >
      <PromptFileChips items={files} onRemove={removeFile} />
      {fileError && <p className="lp-prompt-error">{fileError}</p>}
      {error && (
        <p className="lp-prompt-error" role="alert">
          {error}{" "}
          {error === t("createNeedsKey") ? (
            <Link href="/settings?tab=generation">{t("openSettings")}</Link>
          ) : null}
        </p>
      )}
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("promptPlaceholder")}
        aria-label={t("promptAria")}
        rows={compact ? 2 : 3}
        disabled={submitting}
      />
      <div className="lp-prompt-actions">
        <input
          ref={fileInputRef}
          type="file"
          className="lp-import-input"
          multiple
          accept={PROMPT_FILE_ACCEPT}
          onChange={onFilesSelected}
        />
        <button
          type="button"
          className="lp-plus"
          aria-label={t("importAria")}
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
        >
          <Icon icon={Plus} />
        </button>
        <button
          type="submit"
          className="lp-send"
          disabled={!canSubmit}
          aria-label={t("create")}
        >
          {submitting ? t("loading") : <Icon icon={ArrowUp} />}
        </button>
      </div>
    </form>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 200)}px`;
  }, [prompt]);

  useEffect(() => {
    return () => {
      files.forEach(revokePromptAttachment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  useEffect(() => {
    const warm = getCachedTemplates(locale);
    if (warm) setTemplates(warm as GalleryTemplate[]);
    void (async () => {
      try {
        const list = await ensureTemplates(locale);
        setTemplates(list as GalleryTemplate[]);
        void refreshTemplatesIfStale(locale).then((fresh) =>
          setTemplates(fresh as GalleryTemplate[]),
        );
      } catch {
        /* landing stays usable without templates */
      }
    })();
  }, [locale]);

  function promptLabels(): PromptLabels {
    return {
      importFiles: t("importFiles"),
      imageAttached: t("promptImageAttached"),
      mdSection: t("promptMdSection"),
      txtSection: t("promptTxtSection"),
      pdfSection: t("promptPdfSection"),
      pdfEmpty: t("promptPdfEmpty"),
    };
  }

  async function goWithPrompt(value: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = value.trim();
      if (!trimmed && !files.length) return;

      if (!getToken()) {
        sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed);
        const localFiles = files
          .filter(
            (item): item is LocalPromptAttachment => item.source === "local",
          )
          .map((item) => item.file);
        if (localFiles.length) await stashPendingFiles(localFiles);
        router.push("/login");
        return;
      }

      const gate = await ensureCanGenerate();
      if (gate === "no_key") {
        setError(t("createNeedsKey"));
        return;
      }

      const project = await createProjectWithAttachments(
        trimmed,
        files,
        t("newProject"),
        promptLabels(),
        locale,
      );
      invalidateProjectsCache();
      prependProject(locale, project);
      files.forEach(revokePromptAttachment);
      setFiles([]);
      setPrompt("");
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSelectTemplate(tpl: GalleryTemplate) {
    if (submitting || forkingId) return;
    if (!getToken()) {
      sessionStorage.setItem(PENDING_TEMPLATE_KEY, tpl.id);
      router.push("/login");
      return;
    }
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
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setForkingId(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void goWithPrompt(prompt);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void goWithPrompt(prompt);
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
    if (submitting) return;
    if (e.dataTransfer.files?.length) {
      setFiles((prev) => {
        const { next, rejected } = mergePromptAttachments(
          prev,
          e.dataTransfer.files,
        );
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

  function goAuth() {
    router.push(authed ? "/dashboard" : "/login");
  }

  const canSubmit = Boolean(prompt.trim() || files.length) && !submitting;
  const year = new Date().getFullYear();

  const promptProps = {
    prompt,
    setPrompt,
    files,
    fileError,
    error,
    submitting,
    canSubmit,
    onSubmit,
    onKeyDown,
    onFilesSelected,
    onPromptDrop,
    removeFile,
  };

  return (
    <div className="landing">
      <header className={`lp-nav${navScrolled ? " is-scrolled" : ""}`}>
        <Link href="/" className="lp-nav-brand" aria-label={t("brandAlt")}>
          <BrandLogo alt="" width={132} height={38} priority />
        </Link>
        <nav className="lp-nav-links" aria-label={t("homeNav")}>
          <a href="#templates">{t("landingNavTemplates")}</a>
          <a href="#how">{t("landingNavHow")}</a>
          <a href="#contribute">{t("landingNavContribute")}</a>
        </nav>
        <div className="lp-nav-right">
          <ThemeSwitch />
          <LocaleSwitch />
          <a
            href={FORGE_CONTRIBUTE}
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-contribute"
            aria-label={t("landingNavContribute")}
          >
            <GithubMark />
            <span className="lp-nav-contribute-label">{t("landingNavContribute")}</span>
          </a>
          <button type="button" className="lp-nav-cta" onClick={goAuth}>
            {t("openForge")}
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-wash" aria-hidden />
        <div className="lp-hero-inner">
          <h1 className="lp-hero-title">
            <span className="lp-hero-claim">{t("landingTitleClaim")}</span>
          </h1>
          <p className="lp-hero-sub">{t("landingSub")}</p>
          <LandingPromptBox
            {...promptProps}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
          />
        </div>
      </section>

      <LandingReveal>
        <section className="lp-proof" aria-label={t("landingProofLabel")}>
          <p className="lp-proof-label">{t("landingProofLabel")}</p>
          <ul className="lp-proof-row">
            <li>{t("landingProof1")}</li>
            <li>{t("landingProof2")}</li>
            <li>{t("landingProof3")}</li>
            <li>{t("landingProof4")}</li>
          </ul>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="lp-how" id="how">
          <h2 className="lp-section-title">{t("landingHowTitle")}</h2>
          <div className="lp-how-grid">
            <div className="lp-how-visual">
              <div className="lp-how-video-shell">
                <div className="lp-how-video-glow" aria-hidden />
                <div className="lp-how-video-frame">
                  <div className="lp-how-video-chrome" aria-hidden>
                    <span className="lp-how-visual-dot" />
                    <span className="lp-how-visual-dot" />
                    <span className="lp-how-visual-dot" />
                    <span className="lp-how-video-chrome-label">
                      Forge preview
                    </span>
                  </div>
                  <div className="lp-how-video-stage">
                    <video
                      className="lp-how-video"
                      src="/video.mp4"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      controls={false}
                      disablePictureInPicture
                      aria-label={t("landingHowVisualAlt")}
                    />
                  </div>
                </div>
              </div>
            </div>
            <ol className="lp-how-steps">
              <li>
                <strong>{t("landingHow1Title")}</strong>
                <p>{t("landingHow1Body")}</p>
              </li>
              <li>
                <strong>{t("landingHow2Title")}</strong>
                <p>{t("landingHow2Body")}</p>
              </li>
              <li>
                <strong>{t("landingHow3Title")}</strong>
                <p>{t("landingHow3Body")}</p>
              </li>
            </ol>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="lp-templates" id="templates">
          <div className="lp-templates-head">
            <h2 className="lp-section-title">{t("landingTemplatesTitle")}</h2>
            <button
              type="button"
              className="lp-templates-all"
              onClick={() => {
                if (authed) router.push("/dashboard?tab=templates");
                else router.push("/login");
              }}
            >
              {t("landingTemplatesAll")}
            </button>
          </div>
          {templates.length > 0 ? (
            <div className="lp-templates-grid">
              {templates.slice(0, 8).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="lp-tpl-card"
                  disabled={Boolean(forkingId) || submitting}
                  onClick={() => void onSelectTemplate(tpl)}
                >
                  <SiteThumb
                    src={tpl.preview_url || `/templates/${tpl.id}/preview`}
                    viewportWidth={480}
                    viewportHeight={300}
                    title={tpl.title}
                    className="lp-tpl-thumb"
                  />
                  <div className="lp-tpl-meta">
                    <strong>{tpl.title}</strong>
                    <span>
                      {forkingId === tpl.id
                        ? t("forkingTemplate")
                        : tpl.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="lp-empty">{t("noTemplates")}</p>
          )}
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="lp-why">
          <h2 className="lp-section-title">{t("landingWhyTitle")}</h2>
          <div className="lp-why-grid">
            <div className="lp-why-item">
              <strong>{t("landingWhy1Value")}</strong>
              <span>{t("landingWhy1Label")}</span>
            </div>
            <div className="lp-why-item">
              <strong>{t("landingWhy2Value")}</strong>
              <span>{t("landingWhy2Label")}</span>
            </div>
            <div className="lp-why-item">
              <strong>{t("landingWhy3Value")}</strong>
              <span>{t("landingWhy3Label")}</span>
            </div>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="lp-contribute" id="contribute">
          <div className="lp-contribute-inner">
            <h2 className="lp-section-title">{t("landingContributeTitle")}</h2>
            <p className="lp-contribute-lead">{t("landingContributeLead")}</p>
            <p className="lp-contribute-body">{t("landingContributeBody")}</p>
            <a
              href={FORGE_CONTRIBUTE}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-contribute-cta"
            >
              <GithubMark />
              {t("landingContributeCta")}
            </a>
          </div>
        </section>
      </LandingReveal>

      <footer className="lp-footer">
        <div className="lp-footer-wash" aria-hidden />
        <div className="lp-footer-panel">
          <div className="lp-footer-brand">
            <BrandLogo alt={t("brandAlt")} width={120} height={34} />
            <p>
              {t("landingFooterTaglineLead")}{" "}
              <a href={RODIUM_SITE} target="_blank" rel="noopener noreferrer">
                RodiumAi
              </a>{" "}
              {t("landingFooterTaglineTail")}
            </p>
            <LandingSocialLinks
              discordLabel={t("socialDiscord")}
              linkedinLabel={t("socialLinkedin")}
              githubLabel={t("socialGithub")}
              youtubeLabel={t("socialYoutube")}
              xLabel={t("socialX")}
            />
          </div>
          <div className="lp-footer-cols">
            <div>
              <h3>{t("landingFooterProduct")}</h3>
              <a href="#templates">{t("landingNavTemplates")}</a>
              <a href="#how">{t("landingNavHow")}</a>
              <a href="#contribute">{t("landingNavContribute")}</a>
              <Link href="/login">{t("landingStart")}</Link>
            </div>
            <div>
              <h3>{t("landingFooterResources")}</h3>
              <a
                href={FORGE_CONTRIBUTE}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterContribute")}
              </a>
              <Link href="/settings?tab=generation">
                {t("settingsTabRodium")}
              </Link>
              <Link href="/dashboard">{t("projects")}</Link>
            </div>
            <div>
              <h3>{t("landingFooterLegal")}</h3>
              <a
                href={RODIUM_LEGAL.help}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterHelp")}
              </a>
              <a
                href={RODIUM_LEGAL.privacy}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterPrivacy")}
              </a>
              <a
                href={RODIUM_LEGAL.terms}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterTerms")}
              </a>
              <a
                href={RODIUM_LEGAL.trust}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterTrust")}
              </a>
              <a
                href={RODIUM_LEGAL.cookies}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingFooterCookies")}
              </a>
              <span>{t("landingFooterRights")}</span>
              <span>© {year} RodiumAi</span>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <ThemeSwitch />
            <LocaleSwitch />
          </div>
        </div>
      </footer>
    </div>
  );
}
