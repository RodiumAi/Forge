"use client";

/**
 * Kind-specific content of a template (GET /templates/{id}/detail): site
 * sections, app screens, codelab steps and files, the design system document.
 * One request per template per page load.
 */

import { useEffect, useState } from "react";

import { googleFontsHref, type DesignSystemDoc } from "@/components/design-system/tokens";
import { apiBase } from "@/lib/api";
import type { Codelab } from "@/lib/contracts/forge-design";

export type TemplateDetail = {
  id: string;
  kind: string;
  fg?: string | null;
  muted?: string | null;
  tone?: string;
  fonts: Record<string, string>;
  sections?: string[];
  screens?: string[];
  codelab?: Codelab;
  steps?: Record<string, string>;
  files?: string[];
  design_system?: DesignSystemDoc;
};

const cache = new Map<string, Promise<TemplateDetail | null>>();

export function loadTemplateDetail(id: string): Promise<TemplateDetail | null> {
  let flight = cache.get(id);
  if (!flight) {
    flight = fetch(`${apiBase()}/templates/${encodeURIComponent(id)}/detail`)
      .then((res) => (res.ok ? (res.json() as Promise<TemplateDetail>) : null))
      .catch(() => null);
    cache.set(id, flight);
  }
  return flight;
}

/** The detail of `id` once loaded (`undefined` while loading, `null` when missing). */
export function useTemplateDetail(id: string | null): TemplateDetail | null | undefined {
  const [detail, setDetail] = useState<TemplateDetail | null | undefined>(undefined);
  useEffect(() => {
    if (!id) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetail(undefined);
    void loadTemplateDetail(id).then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [id]);
  return detail;
}

/** Public URL of a file inside a template's public/ folder ("public/brand/logo.svg"). */
export function templateMediaUrl(id: string, path: string): string {
  return `${apiBase()}/templates/${encodeURIComponent(id)}/media/${path.replace(/^\.?\//, "").replace(/^public\//, "")}`;
}

const loadedFonts = new Set<string>();

/** Adds a Google Fonts stylesheet for the curated families not loaded yet. */
export function ensureFonts(families: (string | null | undefined)[]) {
  if (typeof document === "undefined") return;
  const wanted = families.filter((f): f is string => Boolean(f) && !loadedFonts.has(f as string));
  if (!wanted.length) return;
  const href = googleFontsHref(wanted);
  wanted.forEach((f) => loadedFonts.add(f));
  if (!href) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
