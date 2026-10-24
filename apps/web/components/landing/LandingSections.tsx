"use client";

/**
 * Landing sections under the hero: "What Forge builds" (bento), the template
 * gallery on the paper band, pricing, FAQ and the final call to action.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { PricingPlans } from "@/components/landing/PricingPlans";
import { Reveal } from "@/components/landing/PublicChrome";
import { SiteThumb } from "@/components/SiteThumb";
import { TemplateCard } from "@/components/templates/TemplateCard";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { colorMap, fontFamily } from "@/components/design-system/tokens";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Badge";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { Segmented } from "@/components/ui/Tabs";
import { RODIUM_SITE } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { kindStyle } from "@/lib/kind-style";
import { useEnabledKinds } from "@/lib/kinds";
import {
  GALLERY_FILTERS,
  byKind,
  galleryHref,
  interleaved,
  matchesQuery,
  kindOf,
  type GalleryFilter,
} from "@/lib/public-templates";
import { ensureFonts, templateMediaUrl, useTemplateDetail } from "@/lib/template-detail";

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Ratio = "16:9" | "4:3" | "1:1";
const RATIOS: Ratio[] = ["16:9", "4:3", "1:1"];

/** A hand-built slide that reflows across formats (they are real canvases, not letterboxing). */
function RatioDemo() {
  const { t } = useI18n();
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [auto, setAuto] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    let timer: number | null = null;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting && timer == null) {
            timer = window.setInterval(() => setRatio((r) => RATIOS[(RATIOS.indexOf(r) + 1) % RATIOS.length]), 2600);
          } else if (!entry.isIntersecting && timer != null) {
            window.clearInterval(timer);
            timer = null;
          }
        }),
      { threshold: 0.4 },
    );
    if (frameRef.current) io.observe(frameRef.current);
    return () => {
      io.disconnect();
      if (timer != null) window.clearInterval(timer);
    };
  }, [auto]);

  return (
    <div className="f-lp-ratio">
      <div className="f-lp-ratio-stage">
        <div className="f-lp-ratio-frame" data-r={ratio} ref={frameRef}>
          <div className="f-lp-ratio-slide">
            <div className="bg" style={{ backgroundImage: `url("${templateMediaUrl("slides-pitch-startup", "public/images/hero.webp")}")` }} />
            <div className="txt">
              <i className="bar" />
              <div className="k">{t("lndCapRatioKicker")}</div>
              <div className="t">{t("lndCapRatioDemo")}</div>
            </div>
            <span className="f-by-forge">
              <img src="/brand/forge/forge-icon.svg" alt="" />
              By Forge
            </span>
          </div>
        </div>
      </div>
      <div className="f-lp-ratio-ui">
        <div onPointerDown={() => setAuto(false)} onKeyDown={() => setAuto(false)}>
          <Segmented
            label={t("uiFormat")}
            value={ratio}
            onChange={(next) => {
              setAuto(false);
              setRatio(next);
            }}
            items={RATIOS.map((r) => ({ id: r, label: r }))}
          />
        </div>
        <span className="f-lp-remote">
          <span className="f-lp-clicker" aria-hidden />
          {t("lndCapSlidesRemote")}
        </span>
      </div>
    </div>
  );
}

function Cell({
  className,
  glyph,
  kicker,
  title,
  text,
  children,
}: {
  className: string;
  glyph: GlyphName;
  kicker?: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal as="article" className={`f-lp-cell ${className}`}>
      <span className="f-lp-kicker">
        <Glyph name={glyph} size="sm" />
        {kicker}
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </Reveal>
  );
}

function PreviewThumb({ tpl }: { tpl: GalleryTemplate | undefined }) {
  if (!tpl) return null;
  return (
    <SiteThumb
      src={tpl.preview_url || `/templates/${tpl.id}/preview`}
      viewportWidth={480}
      viewportHeight={252}
      title={tpl.title}
      className="f-thumb-site"
    />
  );
}

export function LandingCapabilities({ templates }: { templates: GalleryTemplate[] }) {
  const { t } = useI18n();
  const lists = useMemo(() => byKind(templates), [templates]);
  const deckCount = lists.slides.length;
  const site = templates.find((x) => x.id === "aurora-ai") ?? lists.web[0];
  const app = templates.find((x) => x.id === "nova-bank") ?? lists.mobile[0];
  const dsId = templates.find((x) => x.id === "design-system-luxe")?.id ?? lists.design_system[0]?.id ?? null;
  const ds = useTemplateDetail(dsId);
  const dsDoc = ds?.design_system;
  const colors = dsDoc ? colorMap(dsDoc) : null;
  const display = dsDoc ? fontFamily(dsDoc, "display") : null;
  useEffect(() => {
    if (display) ensureFonts([display]);
  }, [display]);

  const chips: [GlyphName, string][] = [
    ["file", "PDF"],
    ["presentation", "PPTX"],
    ["code", "HTML"],
    ["link", t("lndCapLiveLink")],
    ["layers", t("lndCapTemplatesN").replace("{n}", String(deckCount || 36))],
  ];

  return (
    <section className="f-lp-section" id="whats-new">
      <div className="f-wrap">
        <Reveal className="f-lp-head">
          <Eyebrow>{t("lndCapEyebrow")}</Eyebrow>
          <h2>{t("lndCapTitle")}</h2>
          <p>{t("lndCapSub")}</p>
        </Reveal>
        <div className="f-lp-bento">
          <Cell
            className="c-slides"
            glyph="presentation"
            kicker={t("lndCapSlidesK")}
            title={t("lndCapSlidesT")}
            text={t("lndCapSlidesP").replace("{n}", String(deckCount || 36))}
          >
            <div className="f-lp-chips">
              {chips.map(([glyph, label]) => (
                <span key={label} className="f-lp-chip">
                  <Glyph name={glyph} size="sm" />
                  {label}
                </span>
              ))}
            </div>
            <RatioDemo />
          </Cell>
          <Cell className="c-sites" glyph="globe" title={t("lndCapSitesT")} text={t("lndCapSitesP")}>
            <div className="f-lp-mini-browser">
              <PreviewThumb tpl={site} />
            </div>
          </Cell>
          <Cell className="c-apps" glyph="smartphone" title={t("lndCapAppsT")} text={t("lndCapAppsP")}>
            <div className="f-lp-mini-browser">
              <PreviewThumb tpl={app} />
            </div>
          </Cell>
          <Cell className="c-codelab" glyph="book" title={t("lndCapCodelabT")} text={t("lndCapCodelabP")}>
            <div className="f-lp-code-mini" aria-hidden>
              <span className="c">{t("lndCapCodelabStep")}</span>
              {"\n"}
              <span className="k">from</span> fastapi <span className="k">import</span> FastAPI{"\n\n"}app = FastAPI(){"\n\n"}
              <span className="k">@app</span>.get(<span className="s">&quot;/tasks&quot;</span>){"\n"}
              <span className="k">def</span> list_tasks():{"\n"}
              {"    "}
              <span className="k">return</span> []
            </div>
          </Cell>
          <Cell className="c-ds" glyph="palette" title={t("lndCapDsT")} text={t("lndCapDsP")}>
            <div className="f-lp-ds-mini">
              {["accent", "bg", "surface", "fg", "muted"].map((key) => (
                <i key={key} style={{ background: colors?.[key] ?? "var(--f-surface-2)" }} />
              ))}
              <div className="type">
                <b style={display ? { fontFamily: `"${display}", serif` } : undefined}>Aa</b>
                <span>{dsDoc ? `${dsDoc.name} · ${display}` : " "}</span>
              </div>
            </div>
          </Cell>
          <Cell className="c-img" glyph="image" title={t("lndCapImgT")} text={t("lndCapImgP")}>
            <div className="f-lp-mosaic">
              <div style={{ backgroundImage: `url("${templateMediaUrl("slides-travel", "public/images/street.webp")}")` }}>
                <span className="tag">{t("lndImgFree")}</span>
              </div>
              <div style={{ backgroundImage: `url("${templateMediaUrl("slides-moodboard", "public/images/ceramic.webp")}")` }} />
              <div style={{ backgroundImage: `url("${templateMediaUrl("slides-science-conference", "public/images/stars.webp")}")` }}>
                <span className="tag">{t("lndImgAi")}</span>
              </div>
            </div>
          </Cell>
        </div>
        <Reveal className="f-lp-strip">
          <div>
            <span className="n">
              <Glyph name="eye" size="sm" />
            </span>
            <div>
              <b>{t("lndStripFreeT")}</b>
              <p>{t("lndStripFreeP")}</p>
              <p style={{ marginTop: 8 }}>
                <span className="f-by-forge">
                  <img src="/brand/forge/forge-icon.svg" alt="" />
                  By Forge
                </span>
              </p>
            </div>
          </div>
          <div>
            <span className="n">
              <Glyph name="download" size="sm" />
            </span>
            <div>
              <b>{t("lndStripStarterT")}</b>
              <p>{t("lndStripStarterP")}</p>
            </div>
          </div>
          <div>
            <span className="n">
              <Glyph name="cpu" size="sm" />
            </span>
            <div>
              <b>{t("lndStripProT")}</b>
              <p>{t("lndStripProP")}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const PAGE = 12;

export function LandingTemplates({ templates, error }: { templates: GalleryTemplate[] | null; error: boolean }) {
  const { t } = useI18n();
  const enabled = useEnabledKinds();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query);
      setShown(PAGE);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const all = useMemo(() => templates ?? [], [templates]);
  const lists = useMemo(() => byKind(all), [all]);
  const filters = GALLERY_FILTERS.filter((f) => f.id === "all" || (enabled.includes(f.id) && lists[f.id].length > 0));
  const items = useMemo(() => {
    const base = filter === "all" ? interleaved(all) : lists[filter];
    return base.filter((tpl) => matchesQuery(tpl, debounced, t(kindStyle(kindOf(tpl)).labelKey as MessageKey)));
  }, [all, lists, filter, debounced, t]);

  return (
    <section className="f-lp-section f-paper f-lp-paper" id="templates">
      <div className="f-wrap">
        <div className="f-lp-head">
          <Eyebrow>{t("lndGalEyebrow")}</Eyebrow>
          <h2>{t("lndGalTitle")}</h2>
          <p>{t("lndGalSub")}</p>
        </div>
        <div className="f-lp-tools">
          <div className="f-lp-filters" role="group" aria-label={t("lndFilters")}>
            {filters.map((f) => {
              const count = f.id === "all" ? all.length : lists[f.id].length;
              return (
                <button
                  key={f.id}
                  type="button"
                  className="f-lp-filter"
                  aria-pressed={filter === f.id}
                  onClick={() => {
                    setFilter(f.id);
                    setShown(PAGE);
                  }}
                >
                  {f.id !== "all" ? <i style={{ background: kindStyle(f.id).color }} aria-hidden /> : null}
                  {t(f.labelKey)}
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
          <label className="f-lp-search">
            <Glyph name="search" size="sm" />
            <span className="f-sr-only">{t("lndSearchTemplates")}</span>
            <input type="search" value={query} placeholder={t("lndSearchTemplates")} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="f-tgrid" aria-live="polite">
          {templates === null ? (
            error ? (
              <p className="f-lp-empty">{t("lndNoTemplates")}</p>
            ) : (
              Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="f-lp-skel-card" aria-hidden>
                  <div className="f-skel" />
                  <div className="f-skel" />
                </div>
              ))
            )
          ) : items.length === 0 ? (
            <p className="f-lp-empty">{t("lndNoResult")}</p>
          ) : (
            items.slice(0, shown).map((tpl, i) => (
              <TemplateCard key={tpl.id} template={tpl} href={galleryHref(tpl.id)} index={i % PAGE} />
            ))
          )}
        </div>
        {items.length > shown ? (
          <div className="f-lp-more">
            <Button variant="ghost" size="lg" onClick={() => setShown((n) => n + PAGE)}>
              {t("lndSeeMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { t } = useI18n();
  return (
    <section className="f-lp-section f-lp-pricing" id="pricing">
      <div className="f-wrap">
        <div className="f-lp-head is-center">
          <Eyebrow>{t("lndPriceEyebrow")}</Eyebrow>
          <h2>{t("lndPriceTitle")}</h2>
          <p>{t("lndPriceSub")}</p>
        </div>
        <PricingPlans />
      </div>
    </section>
  );
}

const FAQ: [MessageKey, MessageKey][] = [
  ["lndFaqQ1", "lndFaqA1"],
  ["lndFaqQ2", "lndFaqA2"],
  ["lndFaqQ3", "lndFaqA3"],
  ["lndFaqQ4", "lndFaqA4"],
  ["lndFaqQ5", "lndFaqA5"],
  ["lndFaqQ6", "lndFaqA6"],
  ["lndFaqQ7", "lndFaqA7"],
];

export function LandingFaq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <section className="f-lp-section" id="faq">
      <div className="f-wrap f-lp-faq-grid">
        <Reveal className="f-lp-head">
          <Eyebrow>{t("lndFaqEyebrow")}</Eyebrow>
          <h2>{t("lndFaqTitle")}</h2>
          <p>{t("lndFaqSub")}</p>
          <div>
            <Button variant="ghost" icon="mail" href={`${RODIUM_SITE}/contact`} external>
              {t("lndContact")}
            </Button>
          </div>
        </Reveal>
        <div className="f-lp-faq-list">
          {FAQ.map(([q, a], i) => {
            const isOpen = open.has(i);
            return (
              <div key={q} className={`f-lp-faq-item${isOpen ? " is-open" : ""}`}>
                <h3>
                  <button type="button" aria-expanded={isOpen} aria-controls={`f-faq-${i}`} id={`f-faq-q-${i}`} onClick={() => toggle(i)}>
                    <span>{t(q)}</span>
                    <span className="pm">
                      <Glyph name="plus" size="sm" />
                    </span>
                  </button>
                </h3>
                <div className="f-lp-faq-body" id={`f-faq-${i}`} role="region" aria-labelledby={`f-faq-q-${i}`} inert={!isOpen || undefined}>
                  <div>
                    <p>{t(a)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingCta({ authed }: { authed: boolean }) {
  const { t } = useI18n();
  return (
    <section className="f-wrap">
      <Reveal className="f-lp-cta">
        <div>
          <h2>{t("lndCtaTitle")}</h2>
          <p>{t("lndCtaSub")}</p>
        </div>
        <div className="actions">
          <Button size="lg" href={authed ? "/dashboard#create" : "/register"}>
            {t("lndCtaBtn")}
          </Button>
          <Button size="lg" variant="ghost" href="#templates">
            {t("lndCtaTpl")}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
