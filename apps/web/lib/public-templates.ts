"use client";

/**
 * The public template catalogue as the landing and the public template page
 * use it: one localized list (session cache, then the API), the gallery's kind
 * filters and the interleaved "All" order of the validated mockup.
 */

import { useEffect, useState } from "react";

import type { GalleryTemplate } from "@/components/TemplateGallery";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { normalizeKind, type ProjectKindId } from "@/lib/kinds";
import { ensureTemplates, getCachedTemplates, refreshTemplatesIfStale } from "@/lib/lists-cache";

export function usePublicTemplates(locale: string): { templates: GalleryTemplate[] | null; error: boolean } {
  const [templates, setTemplates] = useState<GalleryTemplate[] | null>(
    () => (getCachedTemplates(locale) as GalleryTemplate[] | null) ?? null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const warm = getCachedTemplates(locale);
    if (warm) setTemplates(warm as GalleryTemplate[]);
    void ensureTemplates(locale)
      .then((list) => {
        if (!alive) return;
        setTemplates(list as GalleryTemplate[]);
        setError(false);
        void refreshTemplatesIfStale(locale).then((fresh) => {
          if (alive) setTemplates(fresh as GalleryTemplate[]);
        });
      })
      .catch(() => {
        if (alive && !warm) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [locale]);
  return { templates, error };
}

export type GalleryFilter = "all" | ProjectKindId;

export const GALLERY_FILTERS: { id: GalleryFilter; labelKey: MessageKey }[] = [
  { id: "all", labelKey: "lndFilterAll" },
  { id: "web", labelKey: "lndFilterSites" },
  { id: "mobile", labelKey: "lndFilterApps" },
  { id: "slides", labelKey: "lndFilterSlides" },
  { id: "codelab", labelKey: "lndFilterCodelabs" },
  { id: "design_system", labelKey: "lndFilterDs" },
];

/** Decks the "All" view opens with (the mockup's picks), when they exist. */
const PREFERRED_DECKS = [
  "slides-product-launch",
  "slides-annual-report",
  "slides-travel",
  "slides-fundraising",
  "slides-editorial",
  "slides-dev-keynote",
  "slides-brand-presentation",
  "slides-pitch-startup",
];

/** Decks lead and every other kind shows early. */
const ALL_PATTERN: ProjectKindId[] = [
  "slides", "web", "slides", "mobile", "slides", "design_system", "slides", "codelab", "web", "slides", "mobile", "slides",
];

export function kindOf(tpl: GalleryTemplate): ProjectKindId {
  return normalizeKind(tpl.kind);
}

export function byKind(templates: GalleryTemplate[]): Record<ProjectKindId, GalleryTemplate[]> {
  const out: Record<ProjectKindId, GalleryTemplate[]> = { web: [], mobile: [], slides: [], codelab: [], design_system: [] };
  for (const tpl of templates) out[kindOf(tpl)].push(tpl);
  const preferred = PREFERRED_DECKS.map((id) => out.slides.find((t) => t.id === id)).filter(Boolean) as GalleryTemplate[];
  out.slides = [...preferred, ...out.slides.filter((t) => !PREFERRED_DECKS.includes(t.id))];
  return out;
}

/** Every template, interleaved by kind like the mockup's "All" view. */
export function interleaved(templates: GalleryTemplate[]): GalleryTemplate[] {
  const lists = byKind(templates);
  const index: Record<ProjectKindId, number> = { web: 0, mobile: 0, slides: 0, codelab: 0, design_system: 0 };
  const out: GalleryTemplate[] = [];
  let step = 0;
  while (ALL_PATTERN.some((kind) => index[kind] < lists[kind].length)) {
    const kind = ALL_PATTERN[step % ALL_PATTERN.length];
    step += 1;
    if (index[kind] < lists[kind].length) out.push(lists[kind][index[kind]++]);
  }
  return out;
}

export function matchesQuery(tpl: GalleryTemplate, query: string, kindLabel: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${tpl.title} ${tpl.description} ${tpl.tags.join(" ")} ${kindLabel}`.toLowerCase().includes(q);
}

/** Public detail page of a template. */
export function galleryHref(id: string): string {
  return `/gallery/${encodeURIComponent(id)}`;
}
