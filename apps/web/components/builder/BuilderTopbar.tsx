"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Globe,
  Monitor,
  Pencil,
  RefreshCw,
  Settings2,
  Share2,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, apiBase } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { shareSeatLimit, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { BuilderMode, ViewportMode } from "./types";
import { PublishPopover } from "./PublishPopover";
import { ShareProjectModal } from "./ShareProjectModal";
import { sitesUrlForSlug } from "@/lib/sites-url";

type Props = {
  projectName: string;
  projectId: string;
  slug?: string;
  sitesUrl?: string | null;
  publishedAt?: string | null;
  onNameSaved?: (meta: {
    name: string;
    slug?: string;
    sites_url?: string | null;
  }) => void;
  onPublishMetaChange?: (meta: {
    slug: string;
    sites_url: string;
    published_at?: string | null;
  }) => void;
  mainMode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
  viewport: ViewportMode;
  onViewportChange: (v: ViewportMode) => void;
  /** When mobile, hide desktop viewport and default to phone framing. */
  projectPlatform?: "web" | "mobile";
  pages: string[];
  previewPath: string;
  onPreviewPathChange: (path: string) => void;
  previewLive: boolean;
  previewUpdating: boolean;
  previewBusy: boolean;
  onRefreshPreview: () => void;
  /** Only the owner invites. Guests see the collaborator faces instead. */
  canShare?: boolean;
  collaborators?: { name: string | null; email: string; avatar_url: string | null }[];
  /** Ensure draft preview is running, then open it in a new tab. */
  onOpenDraftExternal?: () => Promise<void> | void;
};

export function BuilderTopbar({
  projectName,
  projectId,
  slug,
  sitesUrl,
  publishedAt,
  onNameSaved,
  onPublishMetaChange,
  mainMode,
  onModeChange,
  viewport,
  onViewportChange,
  projectPlatform = "web",
  pages,
  previewPath,
  onPreviewPathChange,
  previewLive,
  previewUpdating,
  previewBusy,
  onRefreshPreview,
  onOpenDraftExternal,
  canShare = true,
  collaborators = [],
}: Props) {
  const { t } = useI18n();
  const shareLimit = shareSeatLimit(useForgeStatus());
  const shareLocked = shareLimit === 0;
  const [shareHint, setShareHint] = useState<{ text: string; id: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [savingName, setSavingName] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSave = useRef(false);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  const previewExternalUrl = `${apiBase()}/preview/${projectId}/`;
  const published = Boolean(publishedAt);
  const liveSiteUrl = published
    ? sitesUrl || (slug ? sitesUrlForSlug(slug) : null)
    : null;
  const [openingDraft, setOpeningDraft] = useState(false);

  useEffect(() => {
    if (!editing) setDraftName(projectName);
  }, [projectName, editing]);

  useEffect(() => {
    if (!shareHint) return;
    const timer = window.setTimeout(() => setShareHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [shareHint]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!openMenu) return;
    function onDoc(e: MouseEvent) {
      if (openMenuRef.current?.contains(e.target as Node)) return;
      setOpenMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!pageMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (pageMenuRef.current?.contains(e.target as Node)) return;
      setPageMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPageMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pageMenuOpen]);

  const modes: { id: BuilderMode; label: string; hint: string; icon: typeof Globe }[] = [
    { id: "preview", label: t("builderModePreview"), hint: t("builderModePreviewHint"), icon: Globe },
    { id: "files", label: t("builderModeFiles"), hint: t("builderModeFilesHint"), icon: FolderOpen },
    { id: "code", label: t("builderModeCode"), hint: t("builderModeCodeHint"), icon: Braces },
    { id: "options", label: t("builderModeOptions"), hint: t("builderModeOptionsHint"), icon: Settings2 },
  ];

  function startEdit() {
    setDraftName(projectName);
    setEditing(true);
  }

  function cancelEdit() {
    skipBlurSave.current = true;
    setDraftName(projectName);
    setEditing(false);
  }

  async function commitName() {
    const next = draftName.trim();
    if (!next || next === projectName) {
      setEditing(false);
      setDraftName(projectName);
      return;
    }
    setSavingName(true);
    try {
      const res = await api<{
        name: string;
        slug: string;
        sites_url?: string | null;
      }>(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      });
      onNameSaved?.({
        name: res.name,
        slug: res.slug,
        sites_url: res.sites_url,
      });
      setEditing(false);
    } catch {
      setDraftName(projectName);
      setEditing(false);
    } finally {
      setSavingName(false);
    }
  }

  async function openDraftExternal() {
    setOpeningDraft(true);
    try {
      if (onOpenDraftExternal) {
        await onOpenDraftExternal();
      } else {
        window.open(previewExternalUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningDraft(false);
      setOpenMenu(false);
    }
  }

  function openLiveExternal() {
    if (!liveSiteUrl) return;
    window.open(liveSiteUrl, "_blank", "noopener,noreferrer");
    setOpenMenu(false);
  }

  return (
    <header className="builder-topbar builder-topbar-lovable">
      <div className="builder-topbar-left">
        <Link href="/dashboard" className="builder-back" title={t("projects")}>
          <Icon icon={ArrowLeft} className="ui-icon-md" />
        </Link>
        <div className="builder-project-meta">
          {editing ? (
            <input
              ref={inputRef}
              className="builder-project-name-input"
              value={draftName}
              disabled={savingName}
              maxLength={200}
              aria-label={t("editProjectName")}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              onBlur={() => {
                if (skipBlurSave.current) {
                  skipBlurSave.current = false;
                  return;
                }
                void commitName();
              }}
            />
          ) : (
            <div className="builder-project-name-row">
              <button
                type="button"
                className="builder-project-name"
                title={t("editProjectName")}
                onClick={startEdit}
              >
                {projectName || t("projectFallback")}
              </button>
              <button
                type="button"
                className="builder-project-name-edit"
                title={t("editProjectName")}
                aria-label={t("editProjectName")}
                onClick={startEdit}
              >
                <Icon icon={Pencil} className="ui-icon-sm" />
              </button>
            </div>
          )}
          <span className={`builder-status ${previewLive ? "live" : ""}`}>
            {previewUpdating
              ? t("previewUpdating")
              : previewLive
                ? t("builderLive")
                : previewBusy
                  ? t("builderStarting")
                  : t("builderOffline")}
          </span>
        </div>
      </div>

      <div className="builder-mode-switch" role="tablist" aria-label={t("builderModes")}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            className={`builder-mode-btn${mainMode === m.id ? " active" : ""}`}
            aria-selected={mainMode === m.id}
            aria-label={`${m.label}. ${m.hint}`}
            onClick={() => onModeChange(m.id)}
            title={`${m.label} — ${m.hint}`}
          >
            <Icon icon={m.icon} className="ui-icon-sm" />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="builder-midbar">
        {mainMode === "preview" && (
          <>
            <div className="builder-viewport-switch" role="group" aria-label={t("builderViewport")}>
              {projectPlatform !== "mobile" && (
              <button
                type="button"
                className={viewport === "desktop" ? "active" : ""}
                title={t("viewportDesktop")}
                onClick={() => onViewportChange("desktop")}
              >
                <Icon icon={Monitor} className="ui-icon-sm" />
              </button>
              )}
              <button
                type="button"
                className={viewport === "tablet" ? "active" : ""}
                title={t("viewportTablet")}
                onClick={() => onViewportChange("tablet")}
              >
                <Icon icon={Tablet} className="ui-icon-sm" />
              </button>
              <button
                type="button"
                className={viewport === "phone" ? "active" : ""}
                title={t("viewportPhone")}
                onClick={() => onViewportChange("phone")}
              >
                <Icon icon={Smartphone} className="ui-icon-sm" />
              </button>
            </div>

            <div className="builder-open-external" ref={openMenuRef}>
              <button
                type="button"
                className="builder-toolbar-btn builder-toolbar-btn-icon"
                title={t("openExternal")}
                aria-label={t("openExternal")}
                aria-haspopup="menu"
                aria-expanded={openMenu}
                disabled={openingDraft || previewBusy}
                onClick={() => {
                  setPageMenuOpen(false);
                  setOpenMenu((v) => !v);
                }}
              >
                <Icon icon={ExternalLink} className="ui-icon-sm" />
                <Icon icon={ChevronDown} className="ui-icon-sm builder-open-chevron" />
              </button>
              {openMenu && (
                <div className="builder-open-menu" role="menu">
                  <p className="builder-open-menu-hint">{t("openExternalHint")}</p>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={openingDraft || previewBusy}
                    onClick={() => void openDraftExternal()}
                  >
                    <Icon icon={ExternalLink} className="ui-icon-sm" />
                    <span>
                      <strong>{t("openExternalPreview")}</strong>
                      <small>{t("openExternalPreviewHint")}</small>
                      <small className="builder-open-url">
                        {previewExternalUrl.replace(/^https?:\/\//, "")}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!liveSiteUrl}
                    onClick={openLiveExternal}
                  >
                    <Icon icon={Globe} className="ui-icon-sm" />
                    <span>
                      <strong>{t("openExternalLive")}</strong>
                      <small>
                        {liveSiteUrl
                          ? t("openExternalLiveHint")
                          : t("openExternalLiveLocked")}
                      </small>
                      {liveSiteUrl ? (
                        <small className="builder-open-url">
                          {liveSiteUrl.replace(/^https?:\/\//, "")}
                        </small>
                      ) : null}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="builder-page-picker" ref={pageMenuRef}>
              <button
                type="button"
                className="builder-page-picker-trigger"
                aria-haspopup="listbox"
                aria-expanded={pageMenuOpen}
                aria-label={t("builderPage")}
                onClick={() => {
                  setOpenMenu(false);
                  setPageMenuOpen((open) => !open);
                }}
              >
                <span className="builder-page-picker-label">{previewPath || "/"}</span>
                <Icon
                  icon={ChevronDown}
                  className={`builder-page-picker-chevron ui-icon-sm${pageMenuOpen ? " open" : ""}`}
                />
              </button>
              {pageMenuOpen ? (
                <div className="builder-page-menu" role="listbox" aria-label={t("builderPage")}>
                  {(pages.length ? pages : ["/"]).map((p) => {
                    const active = p === previewPath;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={active ? "active" : undefined}
                        onClick={() => {
                          onPreviewPathChange(p);
                          setPageMenuOpen(false);
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="builder-toolbar-btn builder-toolbar-btn-restart"
              title={t("restartPreview")}
              aria-label={t("restartPreview")}
              onClick={onRefreshPreview}
              disabled={previewBusy}
            >
              <Icon icon={RefreshCw} className={`ui-icon-md${previewBusy ? " agent-spin" : ""}`} />
            </button>
          </>
        )}
      </div>

      <div className="builder-topbar-right">
        {canShare ? (
        <button
          type="button"
          className={`builder-toolbar-btn builder-toolbar-btn-text${shareLocked ? " is-locked" : ""}`}
          onClick={() => {
            if (shareLocked) {
              setShareOpen(false);
              setShareHint({ text: t("shareLocked"), id: Date.now() });
              return;
            }
            setShareHint(null);
            setShareOpen(true);
          }}
          title={t("shareTitle")}
        >
          <Icon icon={Share2} className="ui-icon-sm" />
          <span>{t("shareAction")}</span>
        </button>
        ) : (
          <CollaboratorFaces people={collaborators} moreLabel={t("projectCollabMore")} />
        )}
        {shareHint ? (
          <p className="builder-share-hint" role="status">
            {shareHint.text}
          </p>
        ) : null}
        {canShare ? (
          <PublishPopover
            projectId={projectId}
            slug={slug}
            sitesUrl={sitesUrl}
            publishedAt={publishedAt}
            onMetaChange={onPublishMetaChange}
          />
        ) : null}
      </div>

      {canShare && shareOpen ? (
        <ShareProjectModal
          projectId={projectId}
          projectName={projectName}
          seatLimit={shareLimit}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </header>
  );
}

function CollaboratorFaces({
  people,
  moreLabel,
}: {
  people: { name: string | null; email: string; avatar_url: string | null }[];
  moreLabel: string;
}) {
  if (people.length === 0) return null;
  const shown = people.length <= 4 ? people : people.slice(0, 3);
  const extra = people.length <= 4 ? 0 : people.length - 3;
  return (
    <div
      className="builder-collab-faces"
      title={people.map((person) => person.name?.trim() || person.email).join(", ")}
    >
      {shown.map((person, index) => {
        const label = person.name?.trim() || person.email;
        return (
          <span key={person.email} className="home-card-avatar" style={{ zIndex: index + 1 }}>
            {person.avatar_url ? <img src={person.avatar_url} alt="" /> : <span>{initials(label)}</span>}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="home-card-avatar is-more" style={{ zIndex: shown.length + 1 }}>
          {moreLabel.replace("{n}", String(extra))}
        </span>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
