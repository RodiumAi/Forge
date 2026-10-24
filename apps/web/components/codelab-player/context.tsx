"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Codelab } from "@/lib/contracts/forge-design";

import { translator, type CodelabLocale, type Translate } from "./strings";

/** A packed or plain download, as published next to the codelab (`downloads.json`). */
export type DownloadInfo = {
  id: string;
  label: string;
  path: string;
  /** URL of the file, or of its ZIP when `zip` is set. */
  url?: string;
  /** Bytes of the file or ZIP, when known. */
  size?: number;
  /** File name offered to the browser. */
  name?: string;
  zip?: boolean;
};

export type RenderEnv = {
  t: Translate;
  locale: CodelabLocale;
  /** URL of a project file ("public/images/x.webp", "files/starter/main.py"). */
  assetUrl: (path: string) => string;
  /** Downloads declared in codelab.json, with their published URL and size when known. */
  downloads: DownloadInfo[];
  /** Key prefix of the browser storage (tab choices). */
  storageKey: string;
  /** Print or PDF rendering: long blocks start expanded. */
  print?: boolean;
};

export function defaultEnv(locale: CodelabLocale = "fr"): RenderEnv {
  return { t: translator(locale), locale, assetUrl: (path) => path, downloads: [], storageKey: "forge-codelab" };
}

const EnvContext = createContext<RenderEnv>(defaultEnv());

export function RenderEnvProvider({ value, children }: { value: RenderEnv; children: ReactNode }) {
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

export function useRenderEnv(): RenderEnv {
  return useContext(EnvContext);
}

/** Declared downloads merged with what is known about their published files. */
export function downloadsOf(codelab: Codelab, known?: DownloadInfo[]): DownloadInfo[] {
  const byId = new Map((known ?? []).map((item) => [item.id, item]));
  return (codelab.downloads ?? []).map((item) => ({ ...item, ...(byId.get(item.id) ?? {}) }));
}

export function formatBytes(bytes: number | undefined, locale: CodelabLocale): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  const units = locale === "fr" ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(value < 10 ? 1 : 0);
  return `${locale === "fr" ? text.replace(".", ",") : text} ${units[unit]}`;
}
