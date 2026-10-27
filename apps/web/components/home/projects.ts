/**
 * Project rows of the home: the shape the list endpoint returns, the filters
 * of the Projects and Design systems tabs, and the thumbnail sources (moved
 * here unchanged from the old dashboard page).
 */

import { normalizeKind, type ProjectKindId } from "@/lib/kinds";
import { projectThumbnailUrl } from "@/lib/project-thumbnail";

export type HomePerson = { name: string | null; email: string; avatar_url: string | null };

export type HomeProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at?: string;
  template_id?: string | null;
  preview_running?: boolean;
  public_url?: string | null;
  has_thumbnail?: boolean;
  /** mtime of the stored card image, changes when the API re-renders it. */
  thumbnail_at?: number | null;
  platform?: ProjectKindId;
  /** `owner`, or the accepted share role (`editor`, `viewer`). */
  access_role?: string;
  /** Owner first, then accepted members (see `_people_by_project`). */
  collaborators?: HomePerson[];
};

export type ProjectScope = "all" | "mine" | "shared";
export const PROJECT_SCOPES: readonly ProjectScope[] = ["all", "mine", "shared"];

export function isOwned(project: HomeProject): boolean {
  return !project.access_role || project.access_role === "owner";
}

export function canEdit(project: HomeProject): boolean {
  return project.access_role !== "viewer";
}

export function kindOf(project: HomeProject): ProjectKindId {
  return normalizeKind(project.platform);
}

export type ProjectFilter = {
  scope: ProjectScope;
  /** `null` = every kind. */
  kind: ProjectKindId | null;
  query: string;
  favoritesOnly: boolean;
  favorites: ReadonlySet<string>;
};

/** Projects matching the toolbar, most recently touched first. */
export function filterProjects(projects: readonly HomeProject[], filter: ProjectFilter): HomeProject[] {
  const q = filter.query.trim().toLowerCase();
  return projects
    .filter((p) => {
      if (filter.scope === "mine" && !isOwned(p)) return false;
      if (filter.scope === "shared" && isOwned(p)) return false;
      if (filter.kind && kindOf(p) !== filter.kind) return false;
      if (filter.favoritesOnly && !filter.favorites.has(p.id)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.slug || "").toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => stamp(b) - stamp(a));
}

function stamp(p: HomeProject): number {
  const t = new Date(p.updated_at || p.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** "il y a 8 heures" / "8 hours ago", a plain date past a month. */
export function relativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const lang = locale === "fr" ? "fr" : "en";
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const diffSec = Math.round((date.getTime() - now) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
    return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US");
  } catch {
    return date.toLocaleDateString(lang);
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "F";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

/**
 * The card image of a project: the JPEG the API renders on the server (sites
 * and apps: the home page framed in a 16:9 card with the project name; other
 * kinds when they stored one). Null until it exists: the card then draws its
 * kind placeholder. Cards never run a project live any more.
 */
export function projectCardImage(p: HomeProject): string | null {
  if (!p.has_thumbnail) return null;
  return projectThumbnailUrl(p.id, p.thumbnail_at != null ? String(p.thumbnail_at) : p.updated_at);
}
