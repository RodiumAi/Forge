"use client";

import { FavoriteButton } from "@/components/home/FavoriteButton";
import { KIND_ICONS, KIND_LABEL_KEYS } from "@/components/home/home-kinds";
import { ProjectMenu } from "@/components/home/ProjectMenu";
import { ProjectThumb } from "@/components/home/ProjectThumb";
import { isOwned, kindOf, relativeTime, type HomeProject } from "@/components/home/projects";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** What a row or a card can do with its project; owner-only handlers may be absent. */
export type ProjectActions = {
  open: (project: HomeProject) => void;
  rename?: (project: HomeProject) => void;
  share?: (project: HomeProject) => void;
  remove?: (project: HomeProject) => void;
  isFavorite: (projectId: string) => boolean;
  toggleFavorite: (projectId: string) => void;
  /** ISO time this browser last opened the project, if known. */
  lastOpened: (projectId: string) => string | null;
  onThumbPersisted?: (projectId: string, info?: { updated_at?: string }) => void;
};

/** "Ouvert il y a 8 heures" when we know, else "Modifié ..." from the API. */
export function useWhenLabel() {
  const { t, locale } = useI18n();
  return (project: HomeProject, opened: string | null, mounted: boolean): string => {
    if (!mounted) return "";
    if (opened) return t("homeOpenedAgo").replace("{time}", relativeTime(opened, locale));
    return t("homeEditedAgo").replace("{time}", relativeTime(project.updated_at || project.created_at, locale));
  };
}

type Props = {
  project: HomeProject;
  actions: ProjectActions;
  mediaToken: string | null;
  mounted: boolean;
};

/** Grid card: thumbnail on the kind's tone, kind icon, name, when; star and menu on top. */
export function ProjectCard({ project, actions, mediaToken, mounted }: Props) {
  const { t } = useI18n();
  const when = useWhenLabel();
  const kind = kindOf(project);
  const owned = isOwned(project);
  const kindLabel = t(KIND_LABEL_KEYS[kind]);
  return (
    <article className={`fdh-card fdh-tone-${kind}`} data-kind={kind}>
      <button type="button" className="fdh-card-open" onClick={() => actions.open(project)}>
        <ProjectThumb
          project={project}
          mediaToken={mediaToken}
          onThumbPersisted={(info) => actions.onThumbPersisted?.(project.id, info)}
        />
        <span className="fdh-card-body">
          <span className="fdh-card-kind" title={kindLabel}>
            <Icon icon={KIND_ICONS[kind]} className="ui-icon-sm" />
            <span className="sr-only">{kindLabel}</span>
          </span>
          <span className="fdh-card-text">
            <strong className="fdh-card-name" title={project.name}>
              {project.name}
            </strong>
            <span className="fdh-card-when">{when(project, actions.lastOpened(project.id), mounted)}</span>
          </span>
        </span>
      </button>
      <div className="fdh-card-badges" aria-hidden={owned && !project.public_url}>
        {!owned ? <span className="home-card-badge home-card-badge-shared">{t("projectShared")}</span> : null}
        {project.public_url ? <span className="home-card-badge">{t("projectPublishedBadge")}</span> : null}
      </div>
      <div className="fdh-card-tools">
        <FavoriteButton
          name={project.name}
          active={actions.isFavorite(project.id)}
          onToggle={() => actions.toggleFavorite(project.id)}
        />
        <ProjectMenu
          projectName={project.name}
          onOpen={() => actions.open(project)}
          onRename={owned && actions.rename ? () => actions.rename?.(project) : undefined}
          onShare={owned && actions.share ? () => actions.share?.(project) : undefined}
          onDelete={owned && actions.remove ? () => actions.remove?.(project) : undefined}
        />
      </div>
    </article>
  );
}
