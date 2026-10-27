"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { isOwned, kindOf, relativeTime } from "@/components/home/projects";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { StatePill, type ProjectState } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";

import { projectHref, publishedHost, type AppProject } from "./project-data";
import { ProjectThumb } from "./ProjectThumb";

/** What a card or a row can do; owner-only handlers are left out for shared projects. */
export type ProjectCardActions = {
  open: (project: AppProject) => void;
  rename?: (project: AppProject) => void;
  duplicate?: (project: AppProject) => void;
  share?: (project: AppProject) => void;
  remove?: (project: AppProject) => void;
  isFavorite: (projectId: string) => boolean;
  toggleFavorite: (projectId: string) => void;
  onThumbPersisted?: (projectId: string, info?: { updated_at?: string }) => void;
};

const STATE_GLYPH = { live: "globe", gen: null, draft: "edit", err: "alert" } as const;

export function useStateLabel() {
  const { t } = useI18n();
  return (state: ProjectState) =>
    t(state === "live" ? "apStateLive" : state === "gen" ? "apStateGen" : state === "err" ? "apStateErr" : "apStateDraft");
}

/** "Modifié il y a 3 h" plus "partagé par Awa" on a shared project. */
export function useProjectSubtitle() {
  const { t, locale } = useI18n();
  return (project: AppProject, mounted: boolean) => {
    if (!mounted) return " ";
    const when = t("apEditedAgo").replace("{time}", relativeTime(project.updated_at || project.created_at, locale));
    if (isOwned(project)) return when;
    const owner = project.collaborators?.[0];
    const who = (owner?.name || owner?.email || "").split(/[\s@]/)[0];
    return who ? `${when} · ${t("apSharedBy").replace("{name}", who)}` : `${when} · ${t("apShared")}`;
  };
}

export function ProjectMenu({
  project,
  actions,
  plain,
}: {
  project: AppProject;
  actions: ProjectCardActions;
  /** Toolbar icon button (list rows) instead of the white card button. */
  plain?: boolean;
}) {
  const { t } = useI18n();
  const owned = isOwned(project);
  const label = t("apMoreActions").replace("{name}", project.name);
  return (
    <Popover
      align="end"
      role="menu"
      label={project.name}
      width={230}
      trigger={
        plain ? (
          <IconButton icon="more" label={label} size="sm" plain />
        ) : (
          <button type="button" aria-label={label}>
            <Glyph name="more" size="sm" />
          </button>
        )
      }
    >
      {(close) => (
        <>
          <MenuItem icon="eye" onClick={() => { close(); actions.open(project); }}>
            {t("apOpen")}
          </MenuItem>
          {owned && actions.rename ? (
            <MenuItem icon="edit" onClick={() => { close(); actions.rename?.(project); }}>
              {t("apRename")}
            </MenuItem>
          ) : null}
          {owned && actions.duplicate ? (
            <MenuItem icon="copy" onClick={() => { close(); actions.duplicate?.(project); }}>
              {t("apDuplicate")}
            </MenuItem>
          ) : null}
          {owned && actions.share ? (
            <MenuItem icon="share" onClick={() => { close(); actions.share?.(project); }}>
              {t("apShare")}
            </MenuItem>
          ) : null}
          {owned && actions.remove ? (
            <>
              <MenuSeparator />
              <MenuItem icon="trash" danger onClick={() => { close(); actions.remove?.(project); }}>
                {t("apDelete")}
              </MenuItem>
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}

type CardProps = {
  project: AppProject;
  state: ProjectState;
  actions: ProjectCardActions;
  mediaToken: string | null;
  mounted: boolean;
  index?: number;
};

/** Grid card: thumbnail with state badge, star and menu on hover; kind tile, name and when below. */
export function ProjectCard({ project, state, actions, mediaToken, mounted, index = 0 }: CardProps) {
  const { t } = useI18n();
  const stateLabel = useStateLabel();
  const subtitle = useProjectSubtitle();
  const kind = kindOf(project);
  const style = kindStyle(kind);
  const favorite = actions.isFavorite(project.id);
  const glyph = STATE_GLYPH[state];
  const owner = !isOwned(project) ? project.collaborators?.[0] : null;

  return (
    <article className="f-pcard" style={{ "--i": index } as CSSProperties} data-kind={kind}>
      <div style={{ position: "relative" }}>
        <ProjectThumb
          project={project}
          mediaToken={mediaToken}
          building={state === "gen"}
          onThumbPersisted={(info) => actions.onThumbPersisted?.(project.id, info)}
        />
        <Link
          className="f-pcard-open"
          href={projectHref(project)}
          aria-label={t("apOpenNamed").replace("{name}", project.name)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            actions.open(project);
          }}
        />
        <div className="f-pcard-badges">
          <span className={state === "gen" ? "gen" : undefined}>
            {state === "gen" ? <i aria-hidden /> : glyph ? <Glyph name={glyph} size="xs" /> : null}
            {stateLabel(state)}
          </span>
        </div>
        <div className="f-pcard-tools">
          <button
            type="button"
            className="fav"
            aria-pressed={favorite}
            aria-label={(favorite ? t("apUnfavorite") : t("apFavorite")).replace("{name}", project.name)}
            onClick={() => actions.toggleFavorite(project.id)}
          >
            <Glyph name="star" size="sm" />
          </button>
          <ProjectMenu project={project} actions={actions} />
        </div>
      </div>
      <div className="f-pcard-meta">
        <span className="kicon" style={{ background: style.color }} title={t(style.labelKey)}>
          <Glyph name={style.glyph} size="sm" />
          <span className="f-sr-only">{t(style.labelKey)}</span>
        </span>
        <div className="txt">
          <h3 title={project.name}>{project.name}</h3>
          <div className="sub">{subtitle(project, mounted)}</div>
        </div>
        {owner ? <Avatar name={owner.name || owner.email} src={owner.avatar_url} size="xs" tone="other" /> : null}
      </div>
    </article>
  );
}

/** Row of the list view: mini thumbnail, name, kind, state, when, open. */
export function ProjectRow({ project, state, actions, mediaToken, mounted }: CardProps) {
  const { t, locale } = useI18n();
  const stateLabel = useStateLabel();
  const kind = kindOf(project);
  const host = publishedHost(project);
  const owner = isOwned(project) ? t("apYou") : project.collaborators?.[0]?.name || project.collaborators?.[0]?.email || t("apShared");
  return (
    <div className="f-prow" role="row">
      <span role="cell">
        <Link className="mini" href={projectHref(project)} tabIndex={-1} aria-hidden>
          <ProjectThumb project={project} mediaToken={mediaToken} size="row" />
        </Link>
      </span>
      <div className="nm" role="cell">
        <b>
          <button type="button" onClick={() => actions.open(project)}>
            {project.name}
          </button>
        </b>
        <small>
          {owner}
          {host ? ` · ${host}` : ""}
        </small>
      </div>
      <span className="muted" role="cell">{t(kindStyle(kind).labelKey)}</span>
      <span role="cell">
        <StatePill state={state}>{stateLabel(state)}</StatePill>
      </span>
      <span className="muted" role="cell">
        {mounted ? relativeTime(project.updated_at || project.created_at, locale) : ""}
      </span>
      <span className="act" role="cell">
        <IconButton
          icon="star"
          size="sm"
          plain
          label={(actions.isFavorite(project.id) ? t("apUnfavorite") : t("apFavorite")).replace("{name}", project.name)}
          aria-pressed={actions.isFavorite(project.id)}
          onClick={() => actions.toggleFavorite(project.id)}
        />
        <ProjectMenu project={project} actions={actions} plain />
      </span>
    </div>
  );
}
