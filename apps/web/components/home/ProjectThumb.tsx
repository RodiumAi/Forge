"use client";

import { SiteThumb } from "@/components/SiteThumb";
import { Icon } from "@/components/ui/icon";
import { KIND_ICONS } from "@/components/home/home-kinds";
import { kindOf, thumbSource, type HomeProject } from "@/components/home/projects";

type Props = {
  project: HomeProject;
  mediaToken: string | null;
  /** `row` is the small list thumbnail: placeholders only, no live capture. */
  size?: "card" | "row";
  onThumbPersisted?: (info?: { updated_at?: string }) => void;
};

/**
 * A project thumbnail on the kind's tone. Real captures when the project has
 * one (sites and apps, or a persisted JPEG); a deck shows a stack of blank
 * slides and the other document kinds their icon until thumbnails exist.
 */
export function ProjectThumb({ project, mediaToken, size = "card", onThumbPersisted }: Props) {
  const kind = kindOf(project);
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const source = thumbSource(project, size === "card" ? mediaToken : null, size === "card" ? origin : null);

  if (source && (size === "card" || source.imageSrc)) {
    const vw = source.thumbViewport?.w ?? (kind === "mobile" ? 390 : 1280);
    // Live mobile drafts: capture a 16:10 band, full phone viewports timed out.
    const vh = source.thumbViewport?.h ?? (kind === "mobile" ? 244 : 800);
    return (
      <div className={`fdh-thumb fdh-tone-${kind} fdh-thumb-${size}`}>
        <SiteThumb
          imageSrc={source.imageSrc}
          frameSrc={size === "card" ? source.frameSrc : null}
          src={size === "card" ? source.src : null}
          authPath={size === "card" ? source.authPath : null}
          persistProjectId={size === "card" ? source.persistProjectId : null}
          onThumbPersisted={onThumbPersisted ?? null}
          cacheKey={`${project.id}:${project.updated_at || project.created_at}:${kind}:tm2`}
          title={project.name}
          className={`home-card-thumb${kind === "mobile" ? " home-card-thumb--mobile" : ""}`}
          viewportWidth={vw}
          viewportHeight={vh}
        />
      </div>
    );
  }

  return (
    <div className={`fdh-thumb fdh-tone-${kind} fdh-thumb-${size} fdh-thumb-placeholder`} aria-hidden>
      {kind === "slides" ? (
        <span className="fdh-stack">
          <span className="fdh-stack-sheet fdh-stack-back" />
          <span className="fdh-stack-sheet fdh-stack-mid" />
          <span className="fdh-stack-sheet fdh-stack-front">
            <span className="fdh-stack-line fdh-stack-line-a" />
            <span className="fdh-stack-line fdh-stack-line-b" />
          </span>
        </span>
      ) : (
        <span className="fdh-thumb-icon">
          <Icon icon={KIND_ICONS[kind]} size={size === "row" ? 16 : 34} className="ui-icon" />
        </span>
      )}
    </div>
  );
}
