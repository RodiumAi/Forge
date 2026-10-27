"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AvatarButton } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Sheet } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Tabs";
import { getToken } from "@/lib/api";
import { useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ensureProjects, getCachedProjects } from "@/lib/lists-cache";
import { ensureSession, getSessionSnapshot, subscribeSession, type SessionProfile } from "@/lib/session-cache";
import { signOut } from "@/lib/sign-out";
import { useTheme } from "@/lib/theme/ThemeProvider";

import { CommandPalette } from "./CommandPalette";
import { FrodiCard } from "./FrodiCard";
import { APP_NAV, APP_ROUTES, GITHUB_URL, type AppNavId } from "./nav";

/** Same key as the old home shell: "1" open, "0" collapsed. */
export const SIDEBAR_KEY = "forge_home_sidebar";

function useProfile(): SessionProfile | null {
  const [profile, setProfile] = useState<SessionProfile | null>(() =>
    typeof window !== "undefined" ? (getSessionSnapshot()?.profile ?? null) : null,
  );
  useEffect(() => {
    if (!getToken()) return;
    setProfile(getSessionSnapshot()?.profile ?? null);
    const unsub = subscribeSession((snap) => setProfile(snap?.profile ?? null));
    void ensureSession();
    return unsub;
  }, []);
  return profile;
}

function displayName(profile: SessionProfile | null): string {
  if (profile?.name?.trim()) return profile.name.trim();
  const local = (profile?.email || "").split("@")[0];
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/* ------------------------------------------------------------------ sidebar */

function Sidebar({
  active,
  showTeam,
  projectCount,
  onCollapse,
  collapsed,
  onNavigate,
}: {
  active: AppNavId | null;
  showTeam: boolean;
  projectCount: number | null;
  onCollapse?: () => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <aside className="f-side" aria-label={t("uiSidebar")}>
      <div className="f-side-top">
        <Link className="f-side-logo" href={APP_ROUTES.home} aria-label="Forge by RodiumAi" onClick={onNavigate}>
          <img className="f-logo-dark" src="/brand/forge/forge-logo-dark.svg" alt="Forge by RodiumAi" width={148} height={56} />
          <img className="f-logo-light" src="/brand/forge/forge-logo-light.svg" alt="Forge by RodiumAi" width={148} height={56} />
        </Link>
        <Link className="f-side-icon" href={APP_ROUTES.home} aria-label="Forge">
          <img src="/brand/forge/forge-app-icon-orange.svg" alt="" width={40} height={40} />
        </Link>
        {onCollapse ? (
          <button
            type="button"
            className="f-side-collapse"
            onClick={onCollapse}
            aria-label={collapsed ? t("uiSideExpand") : t("uiSideCollapse")}
            aria-expanded={!collapsed}
          >
            <Glyph name="chevron-left" />
          </button>
        ) : null}
      </div>
      <Link className="f-side-new" href={APP_ROUTES.create} title={t("uiNewProject")} onClick={onNavigate}>
        <Glyph name="plus" />
        <span>{t("uiNewProject")}</span>
      </Link>
      <nav className="f-side-nav" aria-label={t("uiNavLabel")}>
        {APP_NAV.map((group) => (
          <div key={group.labelKey} style={{ display: "contents" }}>
            <div className="f-side-label">{t(group.labelKey)}</div>
            {group.links
              .filter((link) => !link.teamOnly || showTeam)
              .map((link) => (
                <Link
                  key={link.id}
                  className="f-side-link"
                  href={link.href}
                  aria-current={link.id === active ? "page" : undefined}
                  title={t(link.labelKey)}
                  onClick={onNavigate}
                >
                  <Glyph name={link.glyph} />
                  <span>{t(link.labelKey)}</span>
                  {link.id === "projects" && projectCount ? <span className="f-side-count">{projectCount}</span> : null}
                  {link.dot ? <span className="f-side-dot" aria-label={t("uiNew")} /> : null}
                </Link>
              ))}
          </div>
        ))}
      </nav>
      <div className="f-side-foot">
        <FrodiCard />
        <div className="f-side-mini-meter">
          <FrodiCard compact />
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ topbar */

function Topbar({
  title,
  onOpenDrawer,
  onOpenPalette,
  actions,
}: {
  title?: ReactNode;
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
  actions?: ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setPreference } = useTheme();
  const profile = useProfile();
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const name = displayName(profile);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cx("f-topbar", scrolled && "is-scrolled")}>
      <IconButton className="f-drawer-btn" icon="menu" label={t("uiOpenMenu")} onClick={onOpenDrawer} />
      <div className="f-topbar-title">{title}</div>
      <button type="button" className="f-cmdk" onClick={onOpenPalette} aria-keyshortcuts="Control+K Meta+K">
        <Glyph name="search" size="sm" />
        <span className="f-cmdk-lbl">{t("uiSearchPlaceholder")}</span>
        <kbd className="f-kbd">Ctrl K</kbd>
      </button>
      {actions}
      <Segmented
        className="f-hide-mob"
        label={t("uiLanguage")}
        value={locale}
        onChange={(next) => setLocale(next)}
        items={[
          { id: "fr", label: "FR" },
          { id: "en", label: "EN" },
        ]}
      />
      <IconButton
        icon={resolvedTheme === "dark" ? "sun" : "moon"}
        label={resolvedTheme === "dark" ? t("uiThemeLight") : t("uiThemeDark")}
        onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")}
      />
      <IconButton className="f-hide-mob" icon="github" label="GitHub RodiumAi/Forge" href={GITHUB_URL} external />
      <Popover
        align="end"
        label={t("uiAccountMenu")}
        width={260}
        trigger={<AvatarButton name={name || profile?.email} src={profile?.avatar_url} aria-label={name || t("uiAccountMenu")} />}
      >
        {(close) => (
          <>
            <div className="f-menu-head">
              <b>{name || "…"}</b>
              {profile?.email ? (
                <>
                  <br />
                  <small>{profile.email}</small>
                </>
              ) : null}
            </div>
            <MenuItem icon="user" href={APP_ROUTES.profile} onClick={close}>
              {t("uiProfile")}
            </MenuItem>
            <MenuItem icon="card" href={APP_ROUTES.billing} onClick={close}>
              {t("uiNavBilling")}
            </MenuItem>
            <MenuItem icon="globe" href={APP_ROUTES.website} onClick={close}>
              {t("uiBackToSite")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon="logout"
              danger
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut();
              }}
            >
              {signingOut ? t("logoutWorking") : t("uiSignOut")}
            </MenuItem>
          </>
        )}
      </Popover>
    </header>
  );
}

/* ------------------------------------------------------------------ bottom bar */

function BottomNav({ active, onOpenDrawer }: { active: AppNavId | null; onOpenDrawer: () => void }) {
  const { t } = useI18n();
  const item = (id: AppNavId, href: string, glyph: "home" | "folder" | "layers", label: string) => (
    <Link href={href} aria-current={active === id ? "page" : undefined}>
      <Glyph name={glyph} />
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="f-bnav" aria-label={t("uiNavLabel")}>
      {item("home", APP_ROUTES.home, "home", t("uiNavHome"))}
      {item("projects", APP_ROUTES.projects, "folder", t("uiNavProjects"))}
      <Link className="f-fab" href={APP_ROUTES.create} aria-label={t("uiCreate")}>
        <Glyph name="plus" />
      </Link>
      {item("templates", APP_ROUTES.templates, "layers", t("uiNavTemplates"))}
      <button type="button" onClick={onOpenDrawer} aria-haspopup="dialog">
        <Glyph name="menu" />
        <span>{t("uiMenu")}</span>
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ shell */

export type AppShellProps = {
  children: ReactNode;
  /** Highlighted sidebar and bottom bar entry. */
  active: AppNavId | null;
  /** Topbar title (page name, or a breadcrumb). */
  title?: ReactNode;
  /** Extra topbar buttons before the language switch. */
  actions?: ReactNode;
  /**
   * `app` (default): sidebar, topbar, bottom bar. `bare`: no chrome at all, the
   * page owns the full viewport (the builder workspace).
   */
  chrome?: "app" | "bare";
  /** Main area without the max width and padding (full-height tools). */
  fill?: boolean;
  /** Sidebar default when nothing is stored yet. */
  defaultCollapsed?: boolean;
  storageKey?: string;
};

/**
 * Logged-in app shell of the redesign: collapsible sidebar (remembered) with
 * the FRODI card, sticky topbar with the Ctrl K palette, language, theme,
 * GitHub and the account menu; under 900px a bottom bar with a central Create
 * button and a drawer. `N` starts a new project from anywhere.
 */
export function AppShell({
  children,
  active,
  title,
  actions,
  chrome = "app",
  fill = false,
  defaultCollapsed = false,
  storageKey = SIDEBAR_KEY,
}: AppShellProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const forge = useForgeStatus();
  const planSlug = forge?.plan ?? forge?.entitlements?.plan_slug ?? "";
  const showTeam = planSlug.startsWith("team");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  // Read after mount: the warm cache is client-only, the server renders no count.
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setCollapsed(stored === "0");
    } catch {
      /* storage denied: keep the default */
    }
  }, [storageKey]);

  useEffect(() => {
    if (chrome === "bare" || !getToken()) return;
    const warm = getCachedProjects(locale);
    if (warm) setProjectCount(warm.length);
    let alive = true;
    void ensureProjects(locale)
      .then((list) => alive && setProjectCount(list.length))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [chrome, locale]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(storageKey, next ? "0" : "1");
      } catch {
        /* the choice still applies to this page */
      }
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    if (chrome === "bare") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
        return;
      }
      if (
        event.key.toLowerCase() === "n" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingTarget(document.activeElement) &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        event.preventDefault();
        router.push(APP_ROUTES.create);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chrome, router]);

  if (chrome === "bare") {
    return <div className="f-app-bare f-scope">{children}</div>;
  }

  return (
    <div className="f-app" data-collapsed={collapsed ? "true" : "false"}>
      <a className="f-skip" href="#f-main">
        {t("uiSkipToContent")}
      </a>
      <Sidebar
        active={active}
        showTeam={showTeam}
        projectCount={projectCount}
        collapsed={collapsed}
        onCollapse={toggleCollapsed}
      />
      <div className="f-app-main">
        <Topbar title={title} actions={actions} onOpenDrawer={() => setDrawer(true)} onOpenPalette={() => setPalette(true)} />
        <main id="f-main" className={cx("f-page", fill && "f-page-fill")} tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomNav active={active} onOpenDrawer={() => setDrawer(true)} />
      <Sheet open={drawer} onClose={() => setDrawer(false)} side="left" label={t("uiNavLabel")} className="f-drawer" closeLabel={t("uiClose")}>
        <Sidebar active={active} showTeam={showTeam} projectCount={projectCount} onNavigate={() => setDrawer(false)} />
      </Sheet>
      <CommandPalette open={palette} onClose={() => setPalette(false)} showTeam={showTeam} />
    </div>
  );
}
