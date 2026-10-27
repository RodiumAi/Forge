import { apiBase } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/dictionaries";

/** Display order of the catalogue categories (unknown ones follow, sorted). */
export const INTEGRATION_CATEGORIES = [
  "forms",
  "booking",
  "chat",
  "payments",
  "data",
  "auth",
  "email",
  "maps",
  "media",
  "comments",
  "analytics",
  "widgets",
] as const;

export function integrationCategoryKey(cat: string): MessageKey | null {
  return (INTEGRATION_CATEGORIES as readonly string[]).includes(cat) ? (`integCat_${cat}` as MessageKey) : null;
}

/** Logo URL on the API, with a version suffix that busts long-lived browser caches. */
export function integrationLogoSrc(id: string, logoUrl?: string | null): string {
  const path = logoUrl || `/integrations/${id}/logo`;
  const withV = path.includes("?") ? `${path}&v=4` : `${path}?v=4`;
  return withV.startsWith("http") ? withV : `${apiBase()}${withV}`;
}

/** Install method label key ("script", "iframe", "link"). */
export function integrationMethodKey(method: string): MessageKey | null {
  if (method === "script" || method === "iframe" || method === "link") return `apIntegMethod_${method}` as MessageKey;
  return null;
}
