"use client";

/**
 * Project kinds, mirror of `apps/api/app/kinds`.
 *
 * `web` and `mobile` are React code written by the agent; `slides`, `codelab`
 * and `design_system` are documents rendered by a Forge player (contracts in
 * `lib/contracts/`). The document kinds ship dark: the API reports which ones
 * are switched on through `GET /kinds`, and until that answer arrives (or if it
 * fails) only web and mobile are offered, exactly as before.
 */

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export const KIND_IDS = ["web", "mobile", "slides", "codelab", "design_system"] as const;
export type ProjectKindId = (typeof KIND_IDS)[number];

export type KindEngine = "react" | "document";
export type KindEditor = "builder" | "deck" | "codelab" | "design_system";

export type ProjectKind = {
  id: ProjectKindId;
  engine: KindEngine;
  editor: KindEditor;
  /** Toggle label in the create screens. */
  labelKey: MessageKey;
  /** Gallery filter label. */
  galleryLabelKey: MessageKey;
};

export const PROJECT_KINDS: readonly ProjectKind[] = [
  { id: "web", engine: "react", editor: "builder", labelKey: "platformWeb", galleryLabelKey: "templatesKindWeb" },
  { id: "mobile", engine: "react", editor: "builder", labelKey: "platformApp", galleryLabelKey: "templatesKindApp" },
  { id: "slides", engine: "document", editor: "deck", labelKey: "platformSlides", galleryLabelKey: "platformSlides" },
  { id: "codelab", engine: "document", editor: "codelab", labelKey: "platformCodelab", galleryLabelKey: "platformCodelab" },
  {
    id: "design_system",
    engine: "document",
    editor: "design_system",
    labelKey: "platformDesignSystem",
    galleryLabelKey: "platformDesignSystem",
  },
];

/** Kinds offered whatever the API says. */
export const ALWAYS_ON_KINDS: readonly ProjectKindId[] = ["web", "mobile"];

export function isKindId(raw: unknown): raw is ProjectKindId {
  return typeof raw === "string" && (KIND_IDS as readonly string[]).includes(raw);
}

/** A registered kind id; anything else becomes `fallback` (web by default). */
export function normalizeKind(raw: unknown, fallback: ProjectKindId = "web"): ProjectKindId {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : raw;
  return isKindId(value) ? value : fallback;
}

export function getKind(id: ProjectKindId): ProjectKind {
  return PROJECT_KINDS.find((kind) => kind.id === id) ?? PROJECT_KINDS[0];
}

/** Route of the editor of a project: the builder, or the document editor of its kind. */
export function editorHref(projectId: string, platform: unknown): string {
  const kind = getKind(normalizeKind(platform));
  if (kind.editor === "deck") return `/projects/${projectId}/deck`;
  if (kind.editor === "design_system") return `/projects/${projectId}/design-system`;
  return `/projects/${projectId}`;
}

export function isReactKind(id: unknown): boolean {
  return isKindId(id) && getKind(id).engine === "react";
}

type KindRow = { id?: unknown; enabled?: unknown };

let enabledCache: ProjectKindId[] | null = null;
let enabledFlight: Promise<ProjectKindId[]> | null = null;

/** Parse `GET /kinds`: the enabled kinds, in registry order, web and mobile always in. */
export function enabledKindsFrom(rows: unknown): ProjectKindId[] {
  const on = new Set<ProjectKindId>(ALWAYS_ON_KINDS);
  if (Array.isArray(rows)) {
    for (const row of rows as KindRow[]) {
      if (row && isKindId(row.id) && row.enabled === true) on.add(row.id);
    }
  }
  return KIND_IDS.filter((id) => on.has(id));
}

export async function fetchEnabledKinds(): Promise<ProjectKindId[]> {
  if (enabledCache) return enabledCache;
  if (!enabledFlight) {
    enabledFlight = api<unknown>("/kinds", { retries: 0 })
      .then((rows) => {
        enabledCache = enabledKindsFrom(rows);
        return enabledCache;
      })
      .catch(() => [...ALWAYS_ON_KINDS])
      .finally(() => {
        enabledFlight = null;
      });
  }
  return enabledFlight;
}

/** For tests: forget the cached answer. */
export function resetEnabledKindsCache() {
  enabledCache = null;
  enabledFlight = null;
}

/** The kinds this instance offers. Starts as web + mobile, then follows `GET /kinds`. */
export function useEnabledKinds(): ProjectKindId[] {
  const [kinds, setKinds] = useState<ProjectKindId[]>(() => enabledCache ?? [...ALWAYS_ON_KINDS]);
  useEffect(() => {
    let alive = true;
    void fetchEnabledKinds().then((next) => {
      if (alive) setKinds(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  return kinds;
}
