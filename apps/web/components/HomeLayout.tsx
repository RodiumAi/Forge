"use client";

/**
 * Compatibility layer: the pages written for the old home shell keep their
 * imports while they render inside the redesign's AppShell
 * (components/shell/AppShell.tsx). New code imports AppShell directly.
 */

import { AppShell, SIDEBAR_KEY as SHELL_SIDEBAR_KEY } from "@/components/shell/AppShell";
import type { AppNavId } from "@/components/shell/nav";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";

export const SIDEBAR_KEY = SHELL_SIDEBAR_KEY;
export const BUILDER_SIDEBAR_KEY = "forge_builder_sidebar";

export type HomeNavItem = AppNavId | null;

const TITLES: Partial<Record<AppNavId, MessageKey>> = {
  home: "uiNavHome",
  projects: "uiNavProjects",
  templates: "uiNavTemplates",
  integrations: "uiNavIntegrations",
  team: "uiNavTeam",
  billing: "uiNavBilling",
  settings: "uiNavSettings",
  how: "landingNavHow",
};

type HomeShellProps = {
  children: React.ReactNode;
  activeNav: HomeNavItem;
  fillMain?: boolean;
  /** false: no app chrome at all (the builder owns the viewport). */
  showTopbar?: boolean;
  storageKey?: string;
  defaultOpen?: boolean;
};

export function HomeShell({ children, activeNav, fillMain = false, showTopbar = true, storageKey, defaultOpen = true }: HomeShellProps) {
  const { t } = useI18n();
  const titleKey = activeNav ? TITLES[activeNav] : undefined;
  return (
    <AppShell
      active={activeNav}
      title={titleKey ? t(titleKey) : undefined}
      chrome={showTopbar ? "app" : "bare"}
      fill={fillMain}
      storageKey={storageKey}
      defaultCollapsed={!defaultOpen}
    >
      {children}
    </AppShell>
  );
}

export function HomeLayout({
  children,
  activeNav,
  fillMain = false,
}: {
  children: React.ReactNode;
  activeNav: HomeNavItem;
  fillMain?: boolean;
}) {
  return (
    <HomeShell activeNav={activeNav} fillMain={fillMain}>
      {children}
    </HomeShell>
  );
}
