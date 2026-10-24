/**
 * Navigation of the logged-in app, in one place. Phase 2 pages that get their
 * own route (projects list, billing) only change the hrefs here.
 */

import type { GlyphName } from "@/components/ui/glyph";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export type AppNavId =
  | "home"
  | "projects"
  | "templates"
  | "integrations"
  | "team"
  | "billing"
  | "settings"
  | "how";

export type AppNavLink = {
  id: AppNavId;
  href: string;
  glyph: GlyphName;
  labelKey: MessageKey;
  /** Shown only on team plans (the page is for Team workspaces). */
  teamOnly?: boolean;
  /** Orange dot: something new behind the link. */
  dot?: boolean;
};

export type AppNavGroup = { labelKey: MessageKey; links: AppNavLink[] };

export const APP_ROUTES = {
  home: "/dashboard",
  /** Create flow: the overview focuses its composer on #create. */
  create: "/dashboard#create",
  projects: "/dashboard?tab=projects",
  templates: "/dashboard?tab=templates",
  integrations: "/integrations",
  team: "/team",
  billing: "/dashboard/pricing",
  settings: "/settings",
  profile: "/settings",
  website: "/",
} as const;

export const APP_NAV: readonly AppNavGroup[] = [
  {
    labelKey: "uiNavWorkspace",
    links: [
      { id: "home", href: APP_ROUTES.home, glyph: "home", labelKey: "uiNavHome" },
      { id: "projects", href: APP_ROUTES.projects, glyph: "folder", labelKey: "uiNavProjects" },
      { id: "templates", href: APP_ROUTES.templates, glyph: "layers", labelKey: "uiNavTemplates" },
      { id: "integrations", href: APP_ROUTES.integrations, glyph: "puzzle", labelKey: "uiNavIntegrations" },
    ],
  },
  {
    labelKey: "uiNavAccount",
    links: [
      { id: "team", href: APP_ROUTES.team, glyph: "users", labelKey: "uiNavTeam", teamOnly: true },
      { id: "billing", href: APP_ROUTES.billing, glyph: "card", labelKey: "uiNavBilling" },
      { id: "settings", href: APP_ROUTES.settings, glyph: "settings", labelKey: "uiNavSettings" },
    ],
  },
];

export { FORGE_REPO as GITHUB_URL } from "@/lib/constants/rodium-links";
