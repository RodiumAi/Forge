"use client";

import { useState } from "react";
import { kindOf, projectCardImage } from "@/components/home/projects";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { kindStyle } from "@/lib/kind-style";

import { DeckThumb } from "./DeckThumb";
import type { AppProject } from "./project-data";

type Props = {
  project: AppProject;
  /** Kept for callers; the card image carries its own media token. */
  mediaToken?: string | null;
  size?: "card" | "row";
  /** Shimmer over the thumbnail while Forge builds. */
  building?: boolean;
  onThumbPersisted?: (info?: { updated_at?: string }) => void;
  className?: string;
};

/**
 * Project thumbnail: the card image the API renders on the server (a plain,
 * lazy <img>, nothing runs in the page), else the first slide for a deck,
 * else the kind's colour with its icon.
 */
export function ProjectThumb({ project, size = "card", building, className }: Props) {
  const kind = kindOf(project);
  const style = kindStyle(kind);
  const card = size === "card";
  const image = projectCardImage(project);
  const [failed, setFailed] = useState<string | null>(null);
  const real = image && failed !== image;
  const [deckMissing, setDeckMissing] = useState(false);
  const deck = kind === "slides" && !real && !deckMissing && card;

  return (
    <div className={cx("f-pthumb", className)} style={real || deck ? undefined : { background: style.color }}>
      {real ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
        <img className="f-pthumb-img" src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(image)} />
      ) : deck ? (
        <DeckThumb projectId={project.id} version={project.updated_at || project.created_at || ""} onMissing={() => setDeckMissing(true)} />
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
