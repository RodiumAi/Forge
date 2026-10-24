"use client";

import { ProjectCard, type ProjectActions } from "@/components/home/ProjectCard";
import type { HomeProject } from "@/components/home/projects";

type Props = {
  projects: readonly HomeProject[];
  actions: ProjectActions;
  mediaToken: string | null;
  mounted: boolean;
  label: string;
};

export function ProjectGrid({ projects, actions, mediaToken, mounted, label }: Props) {
  return (
    <ul className="fdh-grid" aria-label={label}>
      {projects.map((project) => (
        <li key={project.id}>
          <ProjectCard project={project} actions={actions} mediaToken={mediaToken} mounted={mounted} />
        </li>
      ))}
    </ul>
  );
}
