"use client";

/**
 * Top bar of the site and app builder: the shared workspace bar with the view
 * tabs (Preview, Code, History), the "more" menu (files, project settings,
 * design charter, open in a tab), Share and Publish.
 */

import { useEffect, useState } from "react";

import { api, apiBase } from "@/lib/api";
import { Button, IconButton } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Tabs } from "@/components/ui/Tabs";
import { shareSeatLimit, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectKindId } from "@/lib/kinds";
import { sitesUrlForSlug } from "@/lib/sites-url";
import type { BuilderMode } from "./types";
import { PublishPopover } from "./PublishPopover";
import { ShareProjectModal } from "./ShareProjectModal";
import { SaveStatus, WorkspaceBar, type WorkspacePerson, type WorkspaceState } from "./WorkspaceBar";

type Props = {
  projectName: string;
  projectId: string;
  kind: ProjectKindId;
  slug?: string;
  sitesUrl?: string | null;
  publishedAt?: string | null;
  state?: WorkspaceState;
  stateLabel?: string;
  /** Forge is writing files right now. */
  writing?: boolean;
  onNameSaved?: (meta: { name: string; slug?: string; sites_url?: string | null }) => void;
  onPublishMetaChange?: (meta: { slug: string; sites_url: string; published_at?: string | null }) => void;
  mainMode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
  /** Chat rail toggle (desktop). */
  chatOpen?: boolean;
  onToggleChat?: () => void;
  onOpenDesign?: () => void;
  /** Disables Publish (empty project, or Forge is still writing). */
  publishDisabled?: boolean;
  /** Only the owner invites. Guests see the collaborator faces instead. */
  canShare?: boolean;
  collaborators?: WorkspacePerson[];
  /** Ensure draft preview is running, then open it in a new tab. */
  onOpenDraftExternal?: () => Promise<void> | void;
  /** Opens the share dialog from outside (the phone tab bar). */
  shareRequest?: number;
};

export function BuilderTopbar({
  projectName,
  projectId,
  kind,
  slug,
  sitesUrl,
  publishedAt,
  state,
  stateLabel,
  writing,
  onNameSaved,
  onPublishMetaChange,
  mainMode,
  onModeChange,
  chatOpen,
  onToggleChat,
  onOpenDesign,
  publishDisabled,
  onOpenDraftExternal,
  canShare = true,
  collaborators = [],
  shareRequest = 0,
}: Props) {
  const { t } = useI18n();
  const shareLimit = shareSeatLimit(useForgeStatus());
  const shareLocked = shareLimit === 0;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [openingDraft, setOpeningDraft] = useState(false);

  const published = Boolean(publishedAt);
  const liveSiteUrl = published ? sitesUrl || (slug ? sitesUrlForSlug(slug) : null) : null;

  useEffect(() => {
    if (!shareHint) return;
    const timer = window.setTimeout(() => setShareHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [shareHint]);

  function openShare() {
    if (shareLocked) {
      setShareOpen(false);
      setShareHint(t("shareLocked"));
      return;
    }
    setShareHint(null);
    setShareOpen(true);
  }

  // The phone tab bar has its own Share button.
  useEffect(() => {
    if (shareRequest > 0 && canShare) openShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the request counter only
  }, [shareRequest]);

  async function rename(next: string) {
    const res = await api<{ name: string; slug: string; sites_url?: string | null }>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: next }),
    });
    onNameSaved?.({ name: res.name, slug: res.slug, sites_url: res.sites_url });
    return res.name;
  }

  async function openDraftExternal() {
    setOpeningDraft(true);
    try {
      if (onOpenDraftExternal) await onOpenDraftExternal();
      else window.open(`${apiBase()}/preview/${projectId}/`, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningDraft(false);
    }
  }

  // Code, files and settings live in the "views"; history is a tab of its own.
  const tabMode: "preview" | "code" | "history" =
    mainMode === "code" ? "code" : mainMode === "history" ? "history" : "preview";

  const tabs = (
    <Tabs
      className="f-bd-tabs"
      label={t("bdViewsLabel")}
      value={tabMode}
      onChange={(id) => onModeChange(id)}
      items={[
        { id: "preview", label: t("bdTabPreview"), icon: "eye" },
        { id: "code", label: t("bdTabCode"), icon: "code" },
        { id: "history", label: t("bdTabHistory"), icon: "history" },
      ]}
    />
  );

  const more = (
    <Popover
      align="end"
      role="menu"
      label={t("bdMore")}
      width={280}
      trigger={<IconButton icon="more" label={t("bdMore")} size="sm" />}
    >
      {(close) => (
        <>
          <MenuItem
            icon="folder"
            selected={mainMode === "files"}
            onClick={() => {
              close();
              onModeChange("files");
            }}
          >
            {t("bdTabFiles")}
          </MenuItem>
          <MenuItem
            icon="settings"
            selected={mainMode === "options"}
            onClick={() => {
              close();
              onModeChange("options");
            }}
          >
            {t("bdTabSettings")}
          </MenuItem>
          {onOpenDesign ? (
            <MenuItem
              icon="palette"
              onClick={() => {
                close();
                onOpenDesign();
              }}
            >
              {t("bdDesignCharter")}
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <MenuItem
            icon="expand"
            hint={t("openExternalPreviewHint")}
            disabled={openingDraft}
            onClick={() => {
              close();
              void openDraftExternal();
            }}
          >
            {t("openExternalPreview")}
          </MenuItem>
          <MenuItem
            icon="globe"
            hint={liveSiteUrl ? liveSiteUrl.replace(/^https?:\/\//, "") : t("openExternalLiveLocked")}
            disabled={!liveSiteUrl}
            href={liveSiteUrl || undefined}
            external
            onClick={close}
          >
            {t("openExternalLive")}
          </MenuItem>
        </>
      )}
    </Popover>
  );

  return (
    <>
      <WorkspaceBar
        kind={kind}
        name={projectName}
        onRename={rename}
        state={state}
        stateLabel={stateLabel}
        center={tabs}
        saveStatus={<SaveStatus busy={writing} />}
        people={canShare ? [] : collaborators}
        tools={
          <>
            {onToggleChat ? (
              <IconButton
                className="f-bd-hide-mob"
                icon="sparkles"
                size="sm"
                label={t("bdAssistant")}
                aria-pressed={chatOpen}
                onClick={onToggleChat}
              />
            ) : null}
            {more}
          </>
        }
        actions={
          <>
            {canShare ? (
              <Button
                variant="ghost"
                size="sm"
                icon="users"
                className="f-bd-hide-mob"
                aria-disabled={shareLocked || undefined}
                onClick={openShare}
                title={t("shareTitle")}
              >
                {t("bdShare")}
              </Button>
            ) : null}
            {canShare ? (
              <PublishPopover
                projectId={projectId}
                slug={slug}
                sitesUrl={sitesUrl}
                publishedAt={publishedAt}
                onMetaChange={onPublishMetaChange}
                disabled={publishDisabled}
              />
            ) : null}
          </>
        }
      />
      {shareHint ? (
        <p className="f-toast" role="status">
          <Glyph name="lock" size="sm" /> {shareHint}
        </p>
      ) : null}
      {canShare && shareOpen ? (
        <ShareProjectModal
          projectId={projectId}
          projectName={projectName}
          seatLimit={shareLimit}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
