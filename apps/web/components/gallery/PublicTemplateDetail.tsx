"use client";

/**
 * Public template page (/gallery/[id]): breadcrumb, kind switch, the kind's
 * stage on the left, title, facts and actions on the right, "See more" on the
 * paper band. "Use this template" opens the signed-in template page (through
 * sign-in when signed out); "Edit with AI" opens the overview composer
 * prefilled with the template's starting prompt.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import "@/components/design-system/design-system.css";
import { colorEntries, contrastRows, scaleSizes, typeScale } from "@/components/design-system/tokens";
import {
  AppStage,
  CodelabStage,
  DesignSystemStage,
  PartList,
  SlidesStage,
  WebStage,
} from "@/components/gallery/TemplateStages";
import { PublicFooter, PublicNav, useSignedIn } from "@/components/landing/PublicChrome";
import { TemplateCard } from "@/components/templates/TemplateCard";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { Button, IconButton } from "@/components/ui/Button";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { KindBadge } from "@/components/ui/KindBadge";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { apiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { kindStyle } from "@/lib/kind-style";
import { useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import { byKind, galleryHref, kindOf, usePublicTemplates } from "@/lib/public-templates";
import { useTemplateDetail } from "@/lib/template-detail";
import { loadTemplateDeck, type TemplateDeck } from "@/lib/template-deck";

const KIND_ORDER: ProjectKindId[] = ["slides", "web", "mobile", "codelab", "design_system"];

const EXPORT_NOTE: Record<ProjectKindId, MessageKey> = {
  slides: "lndTdExportNote",
  web: "lndTdExportNoteWeb",
  mobile: "lndTdExportNoteWeb",
  codelab: "lndTdExportNoteCl",
  design_system: "lndTdExportNoteDs",
};

type Fact = { value: string; label: string };

function useDeck(id: string | null): TemplateDeck | null | undefined {
  const [deck, setDeck] = useState<TemplateDeck | null | undefined>(undefined);
  useEffect(() => {
    if (!id) {
      setDeck(null);
      return;
    }
    let alive = true;
    setDeck(undefined);
    void loadTemplateDeck(id).then((d) => alive && setDeck(d));
    return () => {
      alive = false;
    };
  }, [id]);
  return deck;
}

/** Where "Use this template" goes: the signed-in template page, or sign-in first. */
export function useTemplateHref(id: string, authed: boolean): string {
  const target = `/templates/${encodeURIComponent(id)}`;
  return authed ? target : `/login?next=${encodeURIComponent(target)}`;
}

export function PublicTemplateDetail({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const authed = useSignedIn();
  const enabled = useEnabledKinds();
  const { templates, error } = usePublicTemplates(locale);
  const tpl = templates?.find((x) => x.id === id) ?? null;
  const kind: ProjectKindId | null = tpl ? kindOf(tpl) : null;
  const deck = useDeck(kind === "slides" ? id : null);
  const detail = useTemplateDetail(tpl && kind !== "slides" ? id : null);
  const [copied, setCopied] = useState(false);
  const lists = useMemo(() => byKind(templates ?? []), [templates]);
  const useHref = useTemplateHref(id, authed);

  useEffect(() => {
    if (tpl) document.title = `${tpl.title} · Forge by RodiumAi`;
  }, [tpl]);

  if (templates === null && !error) {
    return (
      <Frame>
        <div className="f-td-grid" aria-busy="true" aria-label={t("lndTdLoading")}>
          <div className="f-skel" style={{ aspectRatio: "16 / 9", borderRadius: 24 }} />
          <div className="f-skel" style={{ height: 420, borderRadius: 24 }} />
        </div>
      </Frame>
    );
  }
  if (!tpl || !kind) {
    return (
      <Frame>
        <div className="f-td-missing">
          <h1 style={{ fontSize: 32 }}>{t("lndTdNotFound")}</h1>
          <Button href="/#templates" icon="arrow-left" variant="ghost">
            {t("lndTdBackGallery")}
          </Button>
        </div>
      </Frame>
    );
  }

  const style = kindStyle(kind);
  const kindLabel = t(style.labelKey);
  const aiPrompt = tpl.boot_hint || tpl.description;
  const aiTarget = `/dashboard?prompt=${encodeURIComponent(aiPrompt)}`;
  const aiHref = authed ? aiTarget : `/login?next=${encodeURIComponent(aiTarget)}`;
  const previewUrl = `${apiBase()}${tpl.preview_url || `/templates/${tpl.id}/preview`}`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : galleryHref(id);
  const related = lists[kind].filter((x) => x.id !== id).slice(0, 6);
  const ds = detail?.design_system;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      /* clipboard denied */
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: tpl!.title, url: shareUrl });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyLink();
  }

  // Format lines and facts per kind, from the real kit.
  const format: { glyph: GlyphName; text: string }[] = [];
  const facts: Fact[] = [];
  if (kind === "slides" && deck) {
    const size = deck.deck.format;
    const layouts = new Set(deck.deck.slides.map((s) => (s as { layout?: string }).layout).filter(Boolean));
    const transitions = new Set(
      deck.deck.slides.map((s) => (s as { transition?: { type?: string } }).transition?.type).filter(Boolean),
    );
    format.push({
      glyph: "presentation",
      text: t("lndTdSlidesFmt").replace("{w}", String(size?.width ?? 1920)).replace("{h}", String(size?.height ?? 1080)),
    });
    format.push({ glyph: "layers", text: t("lndTdSlidesCount").replace("{n}", String(deck.slides.length)) });
    format.push({ glyph: "expand", text: "16:9 · 4:3 · 1:1" });
    facts.push({ value: String(deck.slides.length), label: t("lndTdSlidesLbl") });
    facts.push({ value: String(layouts.size || deck.slides.length), label: t("lndTdLayouts") });
    facts.push({ value: "3", label: t("lndTdFormats") });
    facts.push({ value: String(transitions.size || 1), label: t("lndTdTransitions") });
  } else if (kind === "web") {
    format.push({ glyph: "globe", text: t("lndTdWebFmt") });
    format.push({ glyph: "monitor", text: t("lndTdWebResponsive") });
    if (detail?.sections?.length) facts.push({ value: String(detail.sections.length), label: t("lndTdPages") });
    facts.push({ value: "3", label: t("lndTdBreakpoints") });
    facts.push({ value: "React", label: "Vite" });
    facts.push({ value: "SEO", label: "Open Graph" });
  } else if (kind === "mobile") {
    format.push({ glyph: "smartphone", text: t("lndTdAppFmt") });
    if (detail?.screens?.length) {
      format.push({ glyph: "layers", text: t("lndScreensN").replace("{n}", String(detail.screens.length)) });
      facts.push({ value: String(detail.screens.length), label: t("lndTdScreens") });
    }
    facts.push({ value: "PWA", label: t("lndTdAppPwa") });
    facts.push({ value: t("lndTdAppTargets"), label: t("lndTdAppTargetsLbl") });
  } else if (kind === "codelab" && detail?.codelab) {
    const cl = detail.codelab;
    const level = { beginner: t("lndBeginner"), intermediate: t("lndIntermediate"), advanced: t("lndAdvanced") }[cl.level];
    format.push({ glyph: "book", text: t("lndTdCodelabFmt").replace("{n}", String(cl.steps.length)) });
    format.push({ glyph: "clock", text: t("lndTdMinutes").replace("{n}", String(cl.durationMinutes)) });
    format.push({ glyph: "signal", text: level });
    facts.push({ value: String(cl.steps.length), label: t("lndTdSteps") });
    facts.push({ value: t("lndTdMinutes").replace("{n}", String(cl.durationMinutes)), label: t("lndTdDuration") });
    facts.push({ value: level, label: t("lndTdLevel") });
    facts.push({ value: String(cl.downloads?.length ?? 0), label: t("lndTdDownloads") });
  } else if (kind === "design_system" && ds) {
    const fonts = detail?.fonts ?? {};
    format.push({ glyph: "palette", text: t("lndTdDsFmt") });
    if (fonts.display) format.push({ glyph: "type", text: [fonts.display, fonts.body].filter(Boolean).join(" + ") });
    const rows = contrastRows(ds);
    const worst = rows.some((r) => !r.pass) ? "AA-" : rows.every((r) => r.level === "AAA") ? "AAA" : "AA";
    const { base, ratio } = typeScale(ds);
    facts.push({ value: String(colorEntries(ds).length), label: t("lndTdColors") });
    facts.push({ value: String(Object.keys(scaleSizes(base, ratio)).length), label: t("lndTdTypeSizes") });
    facts.push({ value: String((ds as { components?: string[] }).components?.length ?? 6), label: t("lndTdComponents") });
    facts.push({ value: `WCAG ${worst}`, label: t("lndTdContrast") });
  }

  const palette =
    kind === "design_system" && ds
      ? colorEntries(ds).slice(0, 6).map((c) => c.value)
      : [tpl.bg, detail?.fg, detail?.muted, tpl.accent].filter((c): c is string => Boolean(c));

  const firstOf = (k: ProjectKindId) => (k === kind ? tpl : lists[k][0]);

  return (
    <Frame>
      <nav className="f-td-crumbs" aria-label={t("lndTdCrumbs")}>
        <ol>
          <li>
            <Link href="/#templates">{t("lndTdBack")}</Link>
            <Glyph name="chevron-right" size="sm" />
          </li>
          <li>
            <span>{kindLabel}</span>
            <Glyph name="chevron-right" size="sm" />
          </li>
          <li>
            <span aria-current="page">{tpl.title}</span>
          </li>
        </ol>
      </nav>
      <nav className="f-td-kinds" aria-label={t("lndTdKinds")}>
        {KIND_ORDER.filter((k) => enabled.includes(k) && firstOf(k)).map((k) => (
          <Link key={k} href={galleryHref(firstOf(k)!.id)} aria-current={k === kind ? "page" : undefined}>
            <Glyph name={kindStyle(k).glyph} size="sm" />
            {t(kindStyle(k).labelKey)}
          </Link>
        ))}
      </nav>

      <div className="f-td-grid">
        <div>
          {kind === "slides" ? <SlidesStage deck={deck} title={tpl.title} /> : null}
          {kind === "web" ? (
            <>
              <WebStage tpl={tpl} />
              <PartList title={t("lndTdPages")} items={detail?.sections ?? []} kind="section" />
            </>
          ) : null}
          {kind === "mobile" ? (
            <>
              <AppStage tpl={tpl} />
              <PartList title={t("lndTdScreens")} items={detail?.screens ?? []} kind="screen" />
            </>
          ) : null}
          {kind === "codelab" ? (
            detail ? <CodelabStage tpl={tpl} detail={detail} /> : <div className="f-td-stage f-skel" style={{ minHeight: 560 }} />
          ) : null}
          {kind === "design_system" ? (
            ds ? <DesignSystemStage tpl={tpl} doc={ds} /> : <div className="f-td-stage f-skel" style={{ minHeight: 560 }} />
          ) : null}
          {kind === "codelab" && detail?.codelab ? (
            <div className="f-td-dodont" style={{ marginTop: 24 }}>
              {detail.codelab.prerequisites?.length ? (
                <div className="f-card">
                  <b>{t("lndTdPrereq")}</b>
                  <ul className="f-td-list">
                    {detail.codelab.prerequisites.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {detail.codelab.learn?.length ? (
                <div className="f-card">
                  <b>{t("lndTdLearn")}</b>
                  <ul className="f-td-list">
                    {detail.codelab.learn.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="f-td-side">
          <div>
            <KindBadge kind={kind} />
          </div>
          <h1>{tpl.title}</h1>
          {format.length ? (
            <div className="f-td-format">
              {format.map((f) => (
                <span key={f.text}>
                  <Glyph name={f.glyph} size="sm" />
                  {f.text}
                </span>
              ))}
            </div>
          ) : null}
          <div className="f-td-author">
            <img src="/brand/forge/forge-icon.svg" alt="" />
            <span>
              {t("lndTdBy")} <b>{t("lndTdForgeTeam")}</b> · {t("lndTdFree")}
            </span>
          </div>
          <div className="f-td-actions">
            <Button size="lg" icon="wand" href={useHref}>
              {t("lndTdUse")}
            </Button>
            <Popover
              align="end"
              label={t("lndTdMore")}
              width={240}
              trigger={<IconButton icon="more" label={t("lndTdMore")} />}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon="link"
                    onClick={() => {
                      void copyLink();
                      close();
                    }}
                  >
                    {copied ? t("lndTdCopied") : t("lndTdCopyLink")}
                  </MenuItem>
                  <MenuItem
                    icon="share"
                    onClick={() => {
                      void share();
                      close();
                    }}
                  >
                    {t("lndTdShare")}
                  </MenuItem>
                  <MenuItem icon="expand" href={previewUrl} external onClick={() => close()}>
                    {t("lndTdOpenPreview")}
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
          <Button className="f-td-ai" variant="ghost" icon="sparkles" href={aiHref} block>
            {t("lndTdAi")}
          </Button>
          {copied ? (
            <p className="f-muted" role="status" style={{ fontSize: 14 }}>
              {t("lndTdCopied")}
            </p>
          ) : null}
          <p className="f-td-desc">{tpl.description}</p>
          {palette.length ? (
            <div className="f-td-palette" aria-hidden>
              {palette.map((c, i) => (
                <i key={`${c}-${i}`} style={{ background: c }} />
              ))}
            </div>
          ) : null}
          {facts.length ? (
            <div className="f-td-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <b>{f.value}</b>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="f-td-note">
            <Glyph name="lock" />
            <span>{t(EXPORT_NOTE[kind])}</span>
          </p>
        </aside>
      </div>

      {related.length ? (
        <section className="f-td-section">
          <div className="f-td-more f-paper">
            <div className="f-lp-head">
              <h2>{t("lndTdSeeMore")}</h2>
              <p>{t("lndTdSeeMoreSub")}</p>
            </div>
            <div className="f-tgrid">
              {related.map((x: GalleryTemplate, i) => (
                <TemplateCard key={x.id} template={x} href={galleryHref(x.id)} index={i} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="f-scope f-lp">
      <PublicNav />
      <main className="f-td" id="main">
        <div className="f-wrap">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
