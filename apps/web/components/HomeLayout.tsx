"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutTemplate,
  Plug,
  Search,
  Settings,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ProfileMenu } from "@/components/ProfileMenu";
import { RodiumWalletBadge } from "@/components/RodiumWalletBadge";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";

export const SIDEBAR_KEY = "forge_home_sidebar";

export type HomeNavItem = "projects" | "templates" | "connectors" | "settings";

type HomeLayoutProps = {
  children: React.ReactNode;
  activeNav: HomeNavItem;
  onSearchClick?: () => void;
  fillMain?: boolean;
};

export function HomeLayout({
  children,
  activeNav,
  onSearchClick,
  fillMain = false,
}: HomeLayoutProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) {
      setSidebarOpen(stored === "1");
      return;
    }
    setSidebarOpen(window.innerWidth > 900);
  }, []);

  function setSidebar(next: boolean) {
    setSidebarOpen(next);
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
  }

  function handleSearch() {
    if (onSearchClick) {
      onSearchClick();
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className={`home ${sidebarOpen ? "home-sidebar-open" : "home-sidebar-collapsed"}`}>
      <div className="home-glow home-glow-a" aria-hidden />
      <div className="home-glow home-glow-b" aria-hidden />
      <div className="home-glow home-glow-c" aria-hidden />
      <div className="home-glow home-glow-d" aria-hidden />

      <aside className="home-sidebar" aria-label={t("homeNav")}>
        <div className="home-sidebar-head">
          <Link href="/dashboard" className="home-sidebar-logo" title={t("projects")}>
            <Image src="/forge-rodiumai.png" alt={t("brandAlt")} width={36} height={36} priority />
            <span className="home-sidebar-brand">{t("projects")}</span>
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
          <button
            type="button"
            className="home-sidebar-btn"
            title={t("searchProjects")}
            onClick={handleSearch}
          >
            <span className="home-sidebar-icon" aria-hidden>
              <Icon icon={Search} />
            </span>
            <span className="home-sidebar-label">{t("searchProjects")}</span>
          </button>
          <Link
            href="/connectors"
            className={`home-sidebar-btn ${activeNav === "connectors" ? "active" : ""}`}
            title={t("connectors")}
          >
            <span className="home-sidebar-icon" aria-hidden>
              <Icon icon={Plug} />
            </span>
            <span className="home-sidebar-label">{t("connectors")}</span>
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
        <button
          type="button"
          className="home-sidebar-toggle"
          onClick={() => setSidebar(!sidebarOpen)}
          aria-label={sidebarOpen ? t("sidebarClose") : t("sidebarOpen")}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <Icon icon={ChevronLeft} /> : <Icon icon={ChevronRight} />}
        </button>
      </aside>

      <div className={`home-main ${fillMain ? "home-main-fill" : ""}`}>
        <header className="home-topbar">
          <div className="home-topbar-spacer" />
          <div className="home-topbar-actions">
            <RodiumWalletBadge />
            <ThemeSwitch />
            <LocaleSwitch />
            <ProfileMenu />
          </div>
        </header>

        <div className={`home-scroll ${fillMain ? "home-scroll-fill" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
