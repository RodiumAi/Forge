"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { KIND_ICONS } from "@/components/home/home-kinds";
import { kindOf, projectCardImage, type HomeProject } from "@/components/home/projects";

type Props = {
  project: HomeProject;
  /** Kept for callers; the card image carries its own media token. */
  mediaToken?: string | null;
  size?: "card" | "row";
  onThumbPersisted?: (info?: { updated_at?: string }) => void;
};

/**
 * A project thumbnail on the kind's tone: the card image the API rendered
 * (a plain, lazy <img>), else a deck shows a stack of blank slides and the
 * other kinds their icon.
 */
export function ProjectThumb({ project, size = "card" }: Props) {
  const kind = kindOf(project);
  const image = projectCardImage(project);
  const [failed, setFailed] = useState<string | null>(null);

  if (image && failed !== image) {
    return (
      <div className={`fdh-thumb fdh-tone-${kind} fdh-thumb-${size} fdh-thumb-image`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
        <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(image)} />
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
