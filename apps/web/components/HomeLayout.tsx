"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { RodiumWalletBadge } from "@/components/RodiumWalletBadge";
import { SidebarApiKeyBlock } from "@/components/SidebarApiKeyBlock";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Icon } from "@/components/ui/icon";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutTemplate,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export const SIDEBAR_KEY = "forge_home_sidebar";
export const BUILDER_SIDEBAR_KEY = "forge_builder_sidebar";

export type HomeNavItem = "projects" | "templates" | "settings" | null;

type HomeShellProps = {
  children: React.ReactNode;
  activeNav: HomeNavItem;
  fillMain?: boolean;
  showTopbar?: boolean;
  storageKey?: string;
  defaultOpen?: boolean;
};

export function HomeShell({
  children,
  activeNav,
  fillMain = false,
  showTopbar = true,
  storageKey = SIDEBAR_KEY,
  defaultOpen = true,
}: HomeShellProps) {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setSidebarOpen(stored === "1");
      return;
    }
    if (defaultOpen) {
      setSidebarOpen(window.innerWidth > 900);
    } else {
      setSidebarOpen(false);
    }
  }, [storageKey, defaultOpen]);

  function setSidebar(next: boolean) {
    setSidebarOpen(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  }

  return (
    <div
      className={`home ${sidebarOpen ? "home-sidebar-open" : "home-sidebar-collapsed"}`}
    >
      <div className="home-glow home-glow-a" aria-hidden />
      <div className="home-glow home-glow-b" aria-hidden />
      <div className="home-glow home-glow-c" aria-hidden />
      <div className="home-glow home-glow-d" aria-hidden />

      <aside className="home-sidebar" aria-label={t("homeNav")}>
        <div className="home-sidebar-head">
          <Link
            href="/dashboard"
            className="home-sidebar-logo"
            title={t("projects")}
          >
            <BrandLogo alt={t("brandAlt")} width={165} height={55} priority />
          </Link>
        </div>
        <nav className="home-sidebar-nav">
          <Link
            href="/dashboard"
            className={`home-sidebar-btn ${activeNav === "projects" ? "active" : ""}`}
            title={t("projects")}
          >
            <span className="home-sidebar-icon" aria-hidden>
              <Icon icon={Home} />
            </span>
            <span className="home-sidebar-label">{t("projects")}</span>
          </Link>
          <Link
            href="/dashboard?tab=templates"
            className={`home-sidebar-btn ${activeNav === "templates" ? "active" : ""}`}
            title={t("navTemplates")}
          >
            <span className="home-sidebar-icon" aria-hidden>
              <Icon icon={LayoutTemplate} />
            </span>
            <span className="home-sidebar-label">{t("navTemplates")}</span>
          </Link>
          <Link
            href="/settings"
            className={`home-sidebar-btn ${activeNav === "settings" ? "active" : ""}`}
            title={t("settings")}
          >
            <span className="home-sidebar-icon" aria-hidden>
              <Icon icon={Settings} />
            </span>
            <span className="home-sidebar-label">{t("settings")}</span>
          </Link>
        </nav>

        <hr className="home-sidebar-divider" />
        <SidebarApiKeyBlock />
        <div className="home-sidebar-wallet">
          <RodiumWalletBadge compact />
        </div>

        <button
          type="button"
          className="home-sidebar-toggle"
          onClick={() => setSidebar(!sidebarOpen)}
          aria-label={sidebarOpen ? t("sidebarClose") : t("sidebarOpen")}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <Icon icon={ChevronLeft} />
          ) : (
            <Icon icon={ChevronRight} />
          )}
        </button>
      </aside>

      <div className={`home-main ${fillMain ? "home-main-fill" : ""}`}>
        {showTopbar ? (
          <header className="home-topbar">
            <div className="home-topbar-spacer" />
            <div className="home-topbar-actions">
              <ThemeSwitch />
              <LocaleSwitch />
              <ProfileMenu />
            </div>
          </header>
        ) : null}

        <div className={`home-scroll ${fillMain ? "home-scroll-fill" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

type HomeLayoutProps = {
  children: React.ReactNode;
  activeNav: Exclude<HomeNavItem, null>;
  fillMain?: boolean;
};

export function HomeLayout({
  children,
  activeNav,
  fillMain = false,
}: HomeLayoutProps) {
  return (
    <HomeShell activeNav={activeNav} fillMain={fillMain} showTopbar>
      {children}
    </HomeShell>
  );
}
