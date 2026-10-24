"use client";

import { Eye, Pencil } from "lucide-react";

import { FavoriteButton } from "@/components/home/FavoriteButton";
import { KIND_LABEL_KEYS } from "@/components/home/home-kinds";
import { useWhenLabel, type ProjectActions } from "@/components/home/ProjectCard";
import { ProjectMenu } from "@/components/home/ProjectMenu";
import { ProjectThumb } from "@/components/home/ProjectThumb";
import { canEdit, isOwned, kindOf, type HomeProject } from "@/components/home/projects";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projects: readonly HomeProject[];
  actions: ProjectActions;
  mounted: boolean;
  label: string;
};

/** List view: thumbnail, name, last opened, owner, access, menu, star. */
export function ProjectList({ projects, actions, mounted, label }: Props) {
  const { t } = useI18n();
  const when = useWhenLabel();
  return (
    <table className="fdh-list" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">{t("homeColName")}</th>
          <th scope="col" className="fdh-col-opened">
            {t("homeColOpened")}
          </th>
          <th scope="col" className="fdh-col-owner">
            {t("homeColOwner")}
          </th>
          <th scope="col" className="fdh-col-access">
            {t("homeColAccess")}
          </th>
          <th scope="col" className="fdh-col-tools">
            <span className="sr-only">{t("homeMenuOpen")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => {
          const kind = kindOf(project);
          const owned = isOwned(project);
          const owner = project.collaborators?.[0];
          const ownerLabel = owned ? t("homeOwnerYou") : owner?.name?.trim() || owner?.email || "";
          const editable = canEdit(project);
          const accessLabel = editable ? t("homeAccessEdit") : t("homeAccessView");
          return (
            <tr key={project.id} data-kind={kind}>
              <td className="fdh-col-name">
                <button type="button" className="fdh-row-open" onClick={() => actions.open(project)}>
                  <ProjectThumb project={project} mediaToken={null} size="row" />
                  <span className="fdh-row-text">
                    <strong title={project.name}>{project.name}</strong>
                    <span className="fdh-row-kind">{t(KIND_LABEL_KEYS[kind])}</span>
                  </span>
                </button>
              </td>
              <td className="fdh-col-opened">{when(project, actions.lastOpened(project.id), mounted)}</td>
              <td className="fdh-col-owner" title={owner?.email}>
                {ownerLabel}
              </td>
              <td className="fdh-col-access">
                <span className="fdh-access" title={accessLabel}>
                  <Icon icon={editable ? Pencil : Eye} className="ui-icon-sm" />
                  <span className="sr-only">{accessLabel}</span>
                </span>
              </td>
              <td className="fdh-col-tools">
                <div className="fdh-row-tools">
                  <ProjectMenu
                    projectName={project.name}
                    onOpen={() => actions.open(project)}
                    onRename={owned && actions.rename ? () => actions.rename?.(project) : undefined}
                    onShare={owned && actions.share ? () => actions.share?.(project) : undefined}
                    onDelete={owned && actions.remove ? () => actions.remove?.(project) : undefined}
                  />
                  <FavoriteButton
                    name={project.name}
                    active={actions.isFavorite(project.id)}
                    onToggle={() => actions.toggleFavorite(project.id)}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
