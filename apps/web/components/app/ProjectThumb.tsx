"use client";

import { kindOf, thumbSource } from "@/components/home/projects";
import { SiteThumb } from "@/components/SiteThumb";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { kindStyle } from "@/lib/kind-style";

import type { AppProject } from "./project-data";

type Props = {
  project: AppProject;
  mediaToken: string | null;
  /** `row` is the small list thumbnail: stored captures only, no live capture. */
  size?: "card" | "row";
  /** Shimmer over the thumbnail while Forge builds. */
  building?: boolean;
  onThumbPersisted?: (info?: { updated_at?: string }) => void;
  className?: string;
};

/**
 * 16:10 project thumbnail: the real capture when the project has one (sites
 * and apps, or a stored JPEG), else the kind's colour with its icon.
 */
export function ProjectThumb({ project, mediaToken, size = "card", building, onThumbPersisted, className }: Props) {
  const kind = kindOf(project);
  const style = kindStyle(kind);
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const card = size === "card";
  const source = thumbSource(project, card ? mediaToken : null, card ? origin : null);
  const real = source && (card || source.imageSrc);

  return (
    <div className={cx("f-pthumb", className)} style={real ? undefined : { background: style.color }}>
      {real && source ? (
        <SiteThumb
          imageSrc={source.imageSrc}
          frameSrc={card ? source.frameSrc : null}
          src={card ? source.src : null}
          authPath={card ? source.authPath : null}
          persistProjectId={card ? source.persistProjectId : null}
          onThumbPersisted={onThumbPersisted ?? null}
          cacheKey={`${project.id}:${project.updated_at || project.created_at}:${kind}:tm2`}
          title={project.name}
          className={cx("home-card-thumb", kind === "mobile" && "home-card-thumb--mobile")}
          viewportWidth={source.thumbViewport?.w ?? (kind === "mobile" ? 390 : 1280)}
          viewportHeight={source.thumbViewport?.h ?? (kind === "mobile" ? 244 : 800)}
        />
      ) : (
        <span className="f-pthumb-ph" aria-hidden>
          <span className="tile">
            <Glyph name={style.glyph} size={card ? "lg" : "sm"} />
          </span>
        </span>
      )}
      {building ? <span className="f-gen-veil" aria-hidden /> : null}
    </div>
  );
}
