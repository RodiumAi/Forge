/** Published site host — must stay aligned with API `sites_url_for_slug()`. */
const LOCAL_SITES_BASE_DOMAIN = "lvh.me:8080";
const PROD_SITES_BASE_DOMAIN = "forge.rodiumai.io";

export function sitesBaseDomain(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITES_BASE_DOMAIN?.trim();
  if (fromEnv) return fromEnv.replace(/^\.+/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "forge.rodiumai.io" || host.endsWith(".forge.rodiumai.io")) {
      return PROD_SITES_BASE_DOMAIN;
    }
  }

  return LOCAL_SITES_BASE_DOMAIN;
}

export function sitesScheme(): "http" | "https" {
  const domain = sitesBaseDomain();
  if (domain.includes("lvh.me") || domain.includes("localhost")) return "http";
  return "https";
}

export function sitesUrlForSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return "";
  return `${sitesScheme()}://${normalized}.${sitesBaseDomain()}`;
}

/** Host (+ port) shown in publish UI before the first deploy. */
export function sitesHostLabel(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return "";
  return `${normalized}.${sitesBaseDomain()}`;
}
