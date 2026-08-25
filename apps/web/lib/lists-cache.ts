import { api, getToken } from "@/lib/api";

const PROJECTS_KEY = "forge_projects_v1";
const TEMPLATES_KEY = "forge_templates_v1";
/** Soft TTL: show cache immediately, refresh in background when older. */
const SOFT_TTL_MS = 90 * 1000;
const HARD_TTL_MS = 30 * 60 * 1000;

export type CachedProject = {
  id: string;
  name: string;
  slug?: string;
  preview_running?: boolean;
  preview_port?: number | null;
  public_url?: string | null;
  sites_url?: string | null;
  template_id?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
};

export type CachedTemplate = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  boot_hint: string;
  accent?: string | null;
  bg?: string | null;
  preview_url?: string | null;
};

type ListEnvelope<T> = {
  tokenFp: string | null;
  locale: string;
  updatedAt: number;
  items: T[];
};

type Listener = () => void;

const projectListeners = new Set<Listener>();
const templateListeners = new Set<Listener>();

let projectsMemory: ListEnvelope<CachedProject> | null = null;
let templatesMemory: ListEnvelope<CachedTemplate> | null = null;
let projectsFlight: Promise<CachedProject[]> | null = null;
let templatesFlight: Promise<CachedTemplate[]> | null = null;

function tokenFingerprint(): string | null {
  const token = getToken();
  if (!token) return null;
  return `${token.slice(0, 10)}.${token.slice(-8)}.${token.length}`;
}

function readStorage<T>(key: string): ListEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListEnvelope<T>;
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.updatedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, envelope: ListEnvelope<T> | null) {
  if (typeof window === "undefined") return;
  try {
    if (!envelope) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    /* quota */
  }
}

function notify(listeners: Set<Listener>) {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function isFresh(updatedAt: number) {
  return Date.now() - updatedAt < SOFT_TTL_MS;
}

function isUsable(updatedAt: number) {
  return Date.now() - updatedAt < HARD_TTL_MS;
}

function projectsSnap(locale: string): ListEnvelope<CachedProject> | null {
  const fp = tokenFingerprint();
  if (!fp) return null;
  const snap = projectsMemory || readStorage<CachedProject>(PROJECTS_KEY);
  if (!snap || snap.tokenFp !== fp || snap.locale !== locale) return null;
  if (!isUsable(snap.updatedAt)) return null;
  if (!projectsMemory) projectsMemory = snap;
  return snap;
}

function templatesSnap(locale: string): ListEnvelope<CachedTemplate> | null {
  const snap = templatesMemory || readStorage<CachedTemplate>(TEMPLATES_KEY);
  if (!snap || snap.locale !== locale) return null;
  if (!isUsable(snap.updatedAt)) return null;
  if (!templatesMemory) templatesMemory = snap;
  return snap;
}

export function getCachedProjects(locale: string): CachedProject[] | null {
  return projectsSnap(locale)?.items ?? null;
}

export function getCachedTemplates(locale: string): CachedTemplate[] | null {
  return templatesSnap(locale)?.items ?? null;
}

export function invalidateProjectsCache() {
  projectsMemory = null;
  writeStorage(PROJECTS_KEY, null);
  notify(projectListeners);
}

export function invalidateTemplatesCache() {
  templatesMemory = null;
  writeStorage(TEMPLATES_KEY, null);
  notify(templateListeners);
}

export function invalidateListsCache() {
  invalidateProjectsCache();
  invalidateTemplatesCache();
}

export function subscribeProjects(listener: Listener): () => void {
  projectListeners.add(listener);
  return () => projectListeners.delete(listener);
}

export function subscribeTemplates(listener: Listener): () => void {
  templateListeners.add(listener);
  return () => templateListeners.delete(listener);
}

function commitProjects(locale: string, items: CachedProject[]) {
  const envelope: ListEnvelope<CachedProject> = {
    tokenFp: tokenFingerprint(),
    locale,
    updatedAt: Date.now(),
    items,
  };
  projectsMemory = envelope;
  writeStorage(PROJECTS_KEY, envelope);
  notify(projectListeners);
}

function commitTemplates(locale: string, items: CachedTemplate[]) {
  const envelope: ListEnvelope<CachedTemplate> = {
    tokenFp: tokenFingerprint(),
    locale,
    updatedAt: Date.now(),
    items,
  };
  templatesMemory = envelope;
  writeStorage(TEMPLATES_KEY, envelope);
  notify(templateListeners);
}

async function fetchProjects(locale: string): Promise<CachedProject[]> {
  if (projectsFlight) return projectsFlight;
  projectsFlight = (async () => {
    try {
      const list = await api<CachedProject[]>("/projects");
      commitProjects(locale, list);
      return list;
    } finally {
      projectsFlight = null;
    }
  })();
  return projectsFlight;
}

async function fetchTemplates(locale: string): Promise<CachedTemplate[]> {
  if (templatesFlight) return templatesFlight;
  templatesFlight = (async () => {
    try {
      const list = await api<CachedTemplate[]>("/templates");
      commitTemplates(locale, list);
      return list;
    } finally {
      templatesFlight = null;
    }
  })();
  return templatesFlight;
}

/**
 * Instant cache + background refresh (single-flight).
 * Soft TTL: return cache immediately; if stale, refresh in background and
 * still return cache now (caller can await a second ensure* with force).
 */
export async function ensureProjects(
  locale: string,
  options?: { force?: boolean },
): Promise<CachedProject[]> {
  const fp = tokenFingerprint();
  if (!fp) {
    invalidateProjectsCache();
    return [];
  }

  const snap = projectsSnap(locale);
  if (options?.force) {
    try {
      return await fetchProjects(locale);
    } catch (err) {
      if (snap) return snap.items;
      throw err;
    }
  }

  if (snap && isFresh(snap.updatedAt)) return snap.items;

  if (snap) {
    void fetchProjects(locale).catch(() => undefined);
    return snap.items;
  }

  try {
    return await fetchProjects(locale);
  } catch (err) {
    throw err;
  }
}

export async function ensureTemplates(
  locale: string,
  options?: { force?: boolean },
): Promise<CachedTemplate[]> {
  const snap = templatesSnap(locale);
  if (options?.force) {
    try {
      return await fetchTemplates(locale);
    } catch (err) {
      if (snap) return snap.items;
      throw err;
    }
  }

  if (snap && isFresh(snap.updatedAt)) return snap.items;

  if (snap) {
    void fetchTemplates(locale).catch(() => undefined);
    return snap.items;
  }

  return fetchTemplates(locale);
}

/** Wait for an in-flight soft refresh if any; otherwise return current cache/network. */
export async function refreshProjectsIfStale(locale: string): Promise<CachedProject[]> {
  const snap = projectsSnap(locale);
  if (snap && isFresh(snap.updatedAt)) return snap.items;
  try {
    return await fetchProjects(locale);
  } catch (err) {
    if (snap) return snap.items;
    throw err;
  }
}

export async function refreshTemplatesIfStale(locale: string): Promise<CachedTemplate[]> {
  const snap = templatesSnap(locale);
  if (snap && isFresh(snap.updatedAt)) return snap.items;
  try {
    return await fetchTemplates(locale);
  } catch (err) {
    if (snap) return snap.items;
    throw err;
  }
}

/** Optimistically prepend a project after create/fork (before navigation). */
export function prependProject(locale: string, project: CachedProject) {
  const prev = getCachedProjects(locale) || [];
  const next = [project, ...prev.filter((p) => p.id !== project.id)];
  commitProjects(locale, next);
}

/** Remove a project from the dashboard cache after delete. */
export function removeProject(locale: string, projectId: string) {
  const prev = getCachedProjects(locale);
  if (!prev) {
    invalidateProjectsCache();
    return;
  }
  commitProjects(
    locale,
    prev.filter((p) => p.id !== projectId),
  );
}
