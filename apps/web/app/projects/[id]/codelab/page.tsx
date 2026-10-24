"use client";

/**
 * Codelab editor route for `codelab` projects (kind editor "codelab"). Other
 * kinds go to their own editor.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CodelabEditor } from "@/components/codelab-editor/CodelabEditor";
import { codelabChatClient } from "@/components/codelab-editor/api";
import { useCodelabStrings } from "@/components/codelab-editor/strings";
import type { CodelabPublisher } from "@/components/codelab-editor/DetailsPanel";
import { api, getToken } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import { badgeRemovable, publishDeck } from "@/lib/deck-exports";
import { useForgeStatus } from "@/lib/forge-status";
import { editorHref, type ProjectKindId } from "@/lib/kinds";
import { useMediaToken } from "@/lib/media-token";

type Project = { id: string; name: string; platform?: ProjectKindId; access_role?: string };

export default function CodelabEditorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const { t } = useCodelabStrings();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = useForgeStatus();
  const mediaToken = useMediaToken();

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
        if (href !== `/projects/${p.id}/codelab`) {
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

  const chat = useMemo(() => codelabChatClient(projectId), [projectId]);
  // Rebuilt when the media token arrives, so images render once it is known.
  const assetUrl = useMemo(() => {
    void mediaToken;
    return (path: string) => projectPublicUrl(projectId, path) ?? "";
  }, [projectId, mediaToken]);

  const removable = badgeRemovable(status);
  // The publish route is shared by every kind; it picks the codelab player for codelabs.
  const publisher = useMemo<CodelabPublisher>(
    () => ({ badgeRemovable: removable, publish: (options) => publishDeck(projectId, { badge: options.badge }) }),
    [projectId, removable],
  );

  if (error) {
    return (
      <div className="cle-root cle-center" role="alert">
        <p>{t("loadError")}</p>
        <p className="cle-hint">{error}</p>
      </div>
    );
  }
  if (!project) {
    return <div className="cle-root cle-center">{t("loading")}</div>;
  }
  const readOnly = project.access_role === "viewer";
  return (
    <CodelabEditor
      projectId={projectId}
      projectName={project.name}
      chat={chat}
      assetUrl={assetUrl}
      publisher={readOnly ? null : publisher}
      readOnly={readOnly}
      backHref="/dashboard"
    />
  );
}
