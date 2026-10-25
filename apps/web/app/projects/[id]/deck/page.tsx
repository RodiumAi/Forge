"use client";

/**
 * Deck editor route for `slides` projects (kind editor "deck"). Other kinds
 * go back to the builder at `/projects/[id]`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DeckEditor } from "@/components/deck-editor/DeckEditor";
import { apiChatClient } from "@/components/deck-editor/chat-client";
import { apiImageClient } from "@/components/deck-editor/images-client";
import { documentTransport, readProjectFile } from "@/components/deck-editor/transport";
import { useDeckStrings } from "@/components/deck-editor/strings";
import { api, getToken } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import { ExportMenu } from "@/components/deck-exports/ExportMenu";
import type { DeckPublisher } from "@/components/deck-editor/PublishMenu";
import { rodiumUpgradeUrl } from "@/lib/constants/rodium-links";
import { badgeRemovable, presenterUrl, publishDeck } from "@/lib/deck-exports";
import { useForgeStatus } from "@/lib/forge-status";
import { clearBootPrompt, peekBootPrompt } from "@/lib/create-project";
import { editorHref, type ProjectKindId } from "@/lib/kinds";
import { useMediaToken } from "@/lib/media-token";

type Project = { id: string; name: string; platform?: ProjectKindId; access_role?: string };

export default function DeckEditorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const { t } = useDeckStrings();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = useForgeStatus();
  const mediaToken = useMediaToken();
  // Brief typed on the home composer; the assistant sends it once on a new deck.
  const [bootPrompt] = useState(() => (typeof window === "undefined" ? null : peekBootPrompt(projectId)));

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    let alive = true;
    api<Project>(`/projects/${projectId}`)
      .then((p) => {
        if (!alive) return;
        const href = editorHref(p.id, p.platform);
        if (href !== `/projects/${p.id}/deck`) {
          router.replace(href);
          return;
        }
        setProject(p);
        document.title = `${p.name} · Forge`;
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, [projectId, router]);

  const transport = useMemo(() => documentTransport(projectId), [projectId]);
  const chat = useMemo(() => apiChatClient(projectId), [projectId]);
  const images = useMemo(() => apiImageClient(projectId), [projectId]);
  const loadTheme = useCallback((file: string) => readProjectFile(projectId, file), [projectId]);
  // Rebuilt when the media token arrives, so images render once it is known.
  const assetUrl = useMemo(() => {
    void mediaToken;
    return (path: string) => projectPublicUrl(projectId, path) ?? "";
  }, [projectId, mediaToken]);

  const removable = badgeRemovable(status);
  const publisher = useMemo<DeckPublisher>(
    () => ({
      badgeRemovable: removable,
      publish: (options) => publishDeck(projectId, options),
      presenterUrl,
    }),
    [projectId, removable],
  );

  if (error) {
    return (
      <div className="de-root de-center" role="alert">
        <p>{t("loadError")}</p>
        <p className="de-hint">{error}</p>
      </div>
    );
  }
  if (!project) {
    return <div className="de-root de-center">{t("loading")}</div>;
  }
  return (
    <DeckEditor
      projectId={projectId}
      projectName={project.name}
      transport={transport}
      loadTheme={loadTheme}
      assetUrl={assetUrl}
      chat={chat}
      images={images}
      badgeRemovable={removable}
      exportMenu={
        <ExportMenu
          projectId={projectId}
          projectName={project.name}
          status={status}
          onUpgrade={() => {
            window.location.href = rodiumUpgradeUrl();
          }}
        />
      }
      publisher={project.access_role === "viewer" ? null : publisher}
      readOnly={project.access_role === "viewer"}
      backHref="/dashboard"
      initialPrompt={bootPrompt}
      onInitialPromptUsed={() => clearBootPrompt(projectId)}
    />
  );
}
