import { APP_ROUTES } from "@/components/shell/nav";

/** Old `?tab=` links of the tabbed home: where each now lives (null: stay on the overview). */
export function legacyTabTarget(raw: string | null): string | null {
  if (raw === "templates") return APP_ROUTES.templates;
  if (raw === "design-systems" || raw === "design_systems") return `${APP_ROUTES.projects}?kind=design_system`;
  if (raw === "projects" || raw === "mine" || raw === "recent") return APP_ROUTES.projects;
  return null;
}

/** Old `/settings?tab=` sections: the anchor of the redesigned settings page. */
export function legacySettingsAnchor(raw: string | null): string | null {
  if (raw === "account") return "profile";
  if (raw === "generation" || raw === "rodium") return "rodiumai";
  if (raw === "security" || raw === "appearance") return raw;
  return null;
}
