"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Globe,
  History,
  Monitor,
  Pencil,
  RefreshCw,
  Settings2,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, apiBase } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";
import type { BuilderMode, ViewportMode } from "./types";
import { formatRouteLabel } from "./types";
import { PublishPopover } from "./PublishPopover";

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
  pages: string[];
  previewPath: string;
  onPreviewPathChange: (path: string) => void;
  previewLive: boolean;
  previewUpdating: boolean;
  previewBusy: boolean;
  onRefreshPreview: () => void;
  onOpenDesign: () => void;
  onOpenHistory: () => void;
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
  pages,
  previewPath,
  onPreviewPathChange,
  previewLive,
  previewUpdating,
  previewBusy,
  onRefreshPreview,
  onOpenDesign,
  onOpenHistory,
  onOpenDraftExternal,
}: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [savingName, setSavingName] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSave = useRef(false);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  const previewExternalUrl = `${apiBase()}/preview/${projectId}/`;
  const published = Boolean(publishedAt);
  const liveSiteUrl = published ? sitesUrl || (slug ? `http://${slug}.lvh.me:8080` : null) : null;
  const [openingDraft, setOpeningDraft] = useState(false);

  useEffect(() => {
    if (!editing) setDraftName(projectName);
  }, [projectName, editing]);

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

  const modes: { id: BuilderMode; label: string; icon: typeof Globe }[] = [
    { id: "preview", label: t("builderModePreview"), icon: Globe },
    { id: "files", label: t("builderModeFiles"), icon: FolderOpen },
    { id: "code", label: t("builderModeCode"), icon: Braces },
    { id: "options", label: t("builderModeOptions"), icon: Settings2 },
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
            onClick={() => onModeChange(m.id)}
            title={m.label}
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
              <button
                type="button"
                className={viewport === "desktop" ? "active" : ""}
                title={t("viewportDesktop")}
                onClick={() => onViewportChange("desktop")}
              >
                <Icon icon={Monitor} className="ui-icon-sm" />
              </button>
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

            {pages.length > 1 ? (
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
                  <span className="builder-page-picker-label">
                    {formatRouteLabel(previewPath, t("builderHomePage"))}
                  </span>
                  <Icon
                    icon={ChevronDown}
                    className={`builder-page-picker-chevron ui-icon-sm${pageMenuOpen ? " open" : ""}`}
                  />
                </button>
                {pageMenuOpen ? (
                  <div className="builder-page-menu" role="listbox" aria-label={t("builderPage")}>
                    {pages.map((p) => {
                      const label = formatRouteLabel(p, t("builderHomePage"));
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
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="builder-toolbar-btn builder-toolbar-btn-restart"
              title={t("restartPreview")}
              aria-label={t("restartPreview")}
              onClick={onRefreshPreview}
              disabled={previewBusy}
            >
              <Icon icon={RefreshCw} className={`ui-icon-md${previewBusy ? " agent-spin" : ""}`} />
              <span className="builder-toolbar-restart-label">{t("restartPreview")}</span>
            </button>
          </>
        )}
      </div>

      <div className="builder-topbar-right">
        <button
          type="button"
          className="builder-toolbar-btn builder-toolbar-btn-text"
          onClick={onOpenDesign}
          title={t("designTitle")}
        >
          {t("designOpen")}
        </button>
        <button
          type="button"
          className="builder-toolbar-btn"
          onClick={onOpenHistory}
          title={t("historyTitle")}
          aria-label={t("historyTitle")}
        >
          <Icon icon={History} className="ui-icon-sm" />
        </button>
        <PublishPopover
          projectId={projectId}
          slug={slug}
          sitesUrl={sitesUrl}
          publishedAt={publishedAt}
          onMetaChange={onPublishMetaChange}
        />
        <LocaleSwitch />
      </div>
    </header>
  );
}
