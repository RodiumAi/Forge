/**
 * Project rows as the redesigned app pages read them: the list endpoint's
 * shape plus the derived state badge and the editor route.
 */

import type { HomeProject } from "@/components/home/projects";
import { kindOf } from "@/components/home/projects";
import type { ProjectState } from "@/components/ui/Badge";

export type AppProject = HomeProject & {
  published_at?: string | null;
  sites_url?: string | null;
  custom_domain?: string | null;
};

const BUILDING = new Set(["running", "awaiting_clarify", "awaiting_plan_confirm"]);

/** Card badge: building now, last run failed, published, or draft. */
export function projectState(project: AppProject, runStates: Record<string, string>): ProjectState {
  const run = runStates[project.id];
  if (run && BUILDING.has(run)) return "gen";
  if (run === "error") return "err";
  if (project.published_at || project.status === "published") return "live";
  return "draft";
}

/** Where a project opens: design systems straight in their editor, the rest in the workspace. */
export function projectHref(project: Pick<AppProject, "id" | "platform">): string {
  return kindOf(project as HomeProject) === "design_system"
    ? `/projects/${project.id}/design-system`
    : `/projects/${project.id}`;
}

/** Host of the published site, without the scheme ("vitrine.forge.site"). */
export function publishedHost(project: AppProject): string | null {
  const raw = project.custom_domain || ((project.published_at || project.status === "published") && project.sites_url) || null;
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
