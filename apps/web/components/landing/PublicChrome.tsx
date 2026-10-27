"use client";

/**
 * Chrome of the public pages (landing, public template detail): the sticky
 * nav with its phone sheet, the footer with the GitHub card, and the scroll
 * reveal used by the landing sections.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ConsentSettingsButton } from "@/components/consent/ConsentSettingsButton";
import { GITHUB_URL } from "@/components/shell/nav";
import { Button, IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { Segmented } from "@/components/ui/Tabs";
import { getToken } from "@/lib/api";
import { RODIUM_LEGAL, RODIUM_SITE, SOCIAL_LINKS } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useTheme } from "@/lib/theme/ThemeProvider";

/** True once mounted with a Forge session in this browser. */
export function useSignedIn(): boolean {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(Boolean(getToken())), []);
  return authed;
}

export function PublicLogo({ className }: { className?: string }) {
  return (
    <Link className={cx("f-lp-logo", className)} href="/" aria-label="Forge by RodiumAi">
      <img className="f-logo-dark" src="/brand/forge/forge-logo-dark.svg" alt="Forge by RodiumAi" width={148} height={56} />
      <img className="f-logo-light" src="/brand/forge/forge-logo-light.svg" alt="Forge by RodiumAi" width={148} height={56} />
    </Link>
  );
}

/** FR / EN switch and theme toggle, shared by the nav, its phone sheet and the auth bar. */
export function PrefControls({ hideClass }: { hideClass?: string }) {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setPreference } = useTheme();
  return (
    <>
      <Segmented
        className={hideClass}
        label={t("uiLanguage")}
        value={locale}
        onChange={(next) => setLocale(next)}
        items={[
          { id: "fr", label: "FR" },
          { id: "en", label: "EN" },
        ]}
      />
      <IconButton
        className={hideClass}
        icon={resolvedTheme === "dark" ? "sun" : "moon"}
        label={resolvedTheme === "dark" ? t("uiThemeLight") : t("uiThemeDark")}
        onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")}
      />
    </>
  );
}

const NAV_LINKS: { hash: string; key: MessageKey }[] = [
  { hash: "create", key: "lndNavCreate" },
  { hash: "templates", key: "lndNavTemplates" },
  { hash: "whats-new", key: "lndNavNew" },
  { hash: "pricing", key: "lndNavPricing" },
  { hash: "faq", key: "lndNavFaq" },
];

/**
 * Sticky nav: logo, section links, FR/EN, GitHub, theme, sign in and start.
 * `onLanding` keeps the links as in-page anchors; elsewhere they go to `/#...`.
 */
export function PublicNav({ onLanding = false }: { onLanding?: boolean }) {
  const { t } = useI18n();
  const authed = useSignedIn();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 1020) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const href = (hash: string) => (onLanding ? `#${hash}` : `/#${hash}`);
  const close = () => setOpen(false);

  return (
    <header className={cx("f-lp-nav", scrolled && "is-scrolled", open && "is-open")}>
      <div className="f-wrap f-lp-nav-inner">
        <PublicLogo />
        <nav className="f-lp-links" aria-label={t("lndNavMain")}>
          {NAV_LINKS.map((link) => (
            <a key={link.hash} href={href(link.hash)}>
              {t(link.key)}
            </a>
          ))}
        </nav>
        <div className="f-lp-right">
          <PrefControls hideClass="f-hide-sm" />
          <IconButton className="f-hide-sm" icon="github" label={t("lndGithubLabel")} href={GITHUB_URL} external />
          {authed ? (
            <Button size="sm" href="/dashboard">
              {t("lndOpenForge")}
            </Button>
          ) : (
            <>
              <Button className="f-hide-md" variant="ghost" size="sm" href="/login">
                {t("lndSignIn")}
              </Button>
              <Button size="sm" href="/register">
                {t("lndStart")}
              </Button>
            </>
          )}
          <IconButton
            ref={burgerRef}
            className="f-lp-burger"
            icon={open ? "x" : "menu"}
            label={t("uiMenu")}
            aria-expanded={open}
            aria-controls="f-lp-sheet"
            onClick={() => setOpen((v) => !v)}
          />
        </div>
      </div>
      <div className={cx("f-lp-sheet", open && "is-open")} id="f-lp-sheet" aria-hidden={!open || undefined}>
        {NAV_LINKS.map((link) => (
          <a key={link.hash} href={href(link.hash)} onClick={close} tabIndex={open ? undefined : -1}>
            {t(link.key)}
          </a>
        ))}
        <div className="f-lp-sheet-row">
          <PrefControls />
          <IconButton icon="github" label={t("lndGithubLabel")} href={GITHUB_URL} external tabIndex={open ? undefined : -1} />
          {authed ? null : (
            <Button variant="ghost" size="sm" href="/login" tabIndex={open ? undefined : -1}>
              {t("lndSignIn")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

type FooterLink = { key: MessageKey; href: string; external?: boolean };

const RESOURCES: FooterLink[] = [
  { key: "lndFDocs", href: `${RODIUM_SITE}/docs`, external: true },
  { key: "lndFGuides", href: `${RODIUM_SITE}/docs/guides`, external: true },
  { key: "lndFCommunity", href: SOCIAL_LINKS.discord, external: true },
  { key: "lndFHelp", href: RODIUM_LEGAL.help, external: true },
];
const COMPANY: FooterLink[] = [
  { key: "lndFApi", href: `${RODIUM_SITE}/docs/api/overview`, external: true },
  { key: "lndFCode", href: `${RODIUM_SITE}/code`, external: true },
  { key: "lndFAbout", href: `${RODIUM_SITE}/about`, external: true },
  { key: "lndFContact", href: `${RODIUM_SITE}/contact`, external: true },
];
const LEGAL: FooterLink[] = [
  { key: "lndFTerms", href: RODIUM_LEGAL.terms, external: true },
  { key: "lndFPrivacy", href: RODIUM_LEGAL.privacy, external: true },
  { key: "lndFTrust", href: RODIUM_LEGAL.trust, external: true },
];
const SOCIALS = [
  { glyph: "github" as const, href: SOCIAL_LINKS.github, label: "GitHub" },
  { glyph: "linkedin" as const, href: SOCIAL_LINKS.linkedin, label: "LinkedIn" },
  { glyph: "youtube" as const, href: SOCIAL_LINKS.youtube, label: "YouTube" },
  { glyph: "xlogo" as const, href: SOCIAL_LINKS.x, label: "X" },
];

function FooterCol({ title, links, extra }: { title: MessageKey; links: FooterLink[]; extra?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <h2>{t(title)}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.key}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {t(link.key)}
              </a>
            ) : (
              <Link href={link.href}>{t(link.key)}</Link>
            )}
          </li>
        ))}
        {extra}
      </ul>
    </div>
  );
}

export function PublicFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const product: FooterLink[] = [
    { key: "lndNavCreate", href: "/#create" },
    { key: "lndNavTemplates", href: "/#templates" },
    { key: "lndNavPricing", href: "/#pricing" },
    { key: "lndSignIn", href: "/login" },
  ];
  return (
    <footer className="f-lp-footer">
      <div className="f-wrap">
        <div className="f-lp-footer-grid">
          <div className="f-lp-footer-brand">
            <PublicLogo />
            <p>{t("lndFooterPitch")}</p>
            <a className="f-lp-gh-card" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Glyph name="github" />
              <span>
                <b>RodiumAi/Forge</b>
                <small>{t("lndFootGithub")}</small>
              </span>
              <Glyph name="arrow-right" size="sm" />
            </a>
          </div>
          <FooterCol title="lndFProduct" links={product} />
          <FooterCol title="lndFResources" links={RESOURCES} />
          <FooterCol title="lndFCompany" links={COMPANY} />
          <FooterCol
            title="lndFLegal"
            links={LEGAL}
            extra={
              <li>
                <ConsentSettingsButton />
              </li>
            }
          />
        </div>
        <div className="f-lp-footer-bottom">
          <span>{t("lndRights").replace("{y}", String(year))}</span>
          <span>{t("lndMadeIn")}</span>
          <div className="f-lp-socials">
            {SOCIALS.map((s) => (
              <IconButton key={s.label} icon={s.glyph} label={s.label} href={s.href} external size="sm" />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Fades a block in the first time it scrolls into view (instant with reduced motion). */
export function Reveal({
  as: Tag = "div",
  className,
  children,
  id,
}: {
  as?: "div" | "article" | "section";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      id={id}
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={cx("f-reveal", shown && "is-in", className)}
    >
      {children}
    </Tag>
  );
}
