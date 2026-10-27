"use client";

/**
 * The left stage of the public template page, one per kind: the real deck
 * with a slide strip, the site or app preview in a device frame, the codelab
 * steps with the rendered step, the design system with its own tokens.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { CODELAB_CSS, CodelabMarkdown, RenderEnvProvider, defaultEnv, resolveCodelabLocale } from "@/components/codelab-player";
import { SlideView } from "@/components/deck-player";
import { ComponentShowcase } from "@/components/design-system/ComponentShowcase";
import {
  colorEntries,
  cssVars,
  fontFamily,
  guidance,
  scaleSizes,
  typeScale,
  type DesignSystemDoc,
} from "@/components/design-system/tokens";
import { SiteThumb } from "@/components/SiteThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { IconButton } from "@/components/ui/Button";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { Segmented } from "@/components/ui/Tabs";
import { apiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ensureFonts, templateMediaUrl, type TemplateDetail } from "@/lib/template-detail";
import type { TemplateDeck } from "@/lib/template-deck";
import { useTheme } from "@/lib/theme/ThemeProvider";

/* ------------------------------------------------------------ slides */

function ratioClass(deck: TemplateDeck["deck"]): string {
  const r = deck.format?.ratio ?? "16:9";
  return `r-${r.replace(":", "-")}`;
}

export function SlidesStage({ deck, title }: { deck: TemplateDeck | null | undefined; title: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const count = deck?.slides.length ?? 0;
  const go = (next: number) => count && setIndex(((next % count) + count) % count);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [index]);

  if (deck === undefined) return <div className="f-td-stage slides f-skel" aria-label={t("lndTdLoading")} />;
  if (!deck) return null;
  const slide = deck.slides[index];
  return (
    <>
      <div
        className={cx("f-td-stage", "slides", ratioClass(deck.deck))}
        role="region"
        aria-roledescription="carousel"
        aria-label={title}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          else if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <div key={slide.id} className="f-td-slide is-in" aria-label={t("lndTdSlideN").replace("{n}", String(index + 1))}>
          <SlideView slide={slide} deck={deck.deck} tokens={deck.tokens} mode="thumbnail" assetUrl={deck.assetUrl} />
        </div>
        <button type="button" className="f-td-nav prev" aria-label={t("lndTdPrev")} onClick={() => go(index - 1)}>
          <Glyph name="chevron-left" />
        </button>
        <button type="button" className="f-td-nav next" aria-label={t("lndTdNext")} onClick={() => go(index + 1)}>
          <Glyph name="chevron-right" />
        </button>
        <div className="f-td-badges">
          <span className="f-by-forge">
            <img src="/brand/forge/forge-icon.svg" alt="" />
            By Forge
          </span>
        </div>
        <span className="f-td-count" aria-live="polite">
          {index + 1} / {count}
        </span>
      </div>
      <div className="f-td-strip-wrap">
        <IconButton icon="chevron-left" label={t("lndTdStripPrev")} onClick={() => stripRef.current?.scrollBy({ left: -360 })} />
        <div className="f-td-strip" ref={stripRef}>
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-current={i === index ? "true" : undefined}
              aria-label={t("lndTdSlideN").replace("{n}", String(i + 1))}
              onClick={() => setIndex(i)}
            >
              <span style={{ position: "absolute", inset: 0 }}>
                <SlideView slide={s} deck={deck.deck} tokens={deck.tokens} mode="thumbnail" assetUrl={deck.assetUrl} />
              </span>
              <span className="n">{i + 1}</span>
            </button>
          ))}
        </div>
        <IconButton icon="chevron-right" label={t("lndTdStripNext")} onClick={() => stripRef.current?.scrollBy({ left: 360 })} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------ website and app */

type Device = "desktop" | "tablet" | "mobile";
const VIEWPORTS: Record<Device, [number, number]> = { desktop: [480, 270], tablet: [360, 480], mobile: [270, 540] };

function hostOf(tpl: GalleryTemplate): string {
  return `${tpl.id.split("-")[0]}.forge.site`;
}

export function WebStage({ tpl }: { tpl: GalleryTemplate }) {
  const { t } = useI18n();
  const [device, setDevice] = useState<Device>("desktop");
  const [w, h] = VIEWPORTS[device];
  return (
    <div className="f-td-stage">
      <div className="f-td-device-bar">
        <span className="f-td-url">
          <Glyph name="lock" size="sm" />
          {hostOf(tpl)}
        </span>
        <Segmented
          label={t("lndTdDevice")}
          value={device}
          onChange={setDevice}
          items={[
            { id: "desktop", label: t("lndTdDesktop"), icon: "monitor" },
            { id: "tablet", label: t("lndTdTablet"), icon: "tablet" },
            { id: "mobile", label: t("lndTdMobile"), icon: "smartphone" },
          ]}
        />
      </div>
      <div className="f-td-device-stage">
        <div className="f-td-device" data-d={device}>
          <div className="f-td-frame">
            <SiteThumb
              key={device}
              src={tpl.preview_url || `/templates/${tpl.id}/preview`}
              viewportWidth={w}
              viewportHeight={h}
              title={tpl.title}
              className="f-thumb-site"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A preview page drawn at its own size (480 x 300) and scaled to the box width. */
function ScaledFrame({ src, title, width, height }: { src: string; title: string; width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setScale(el.clientWidth / width);
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="f-td-frame" style={{ aspectRatio: `${width} / ${height}` }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        sandbox="allow-scripts"
        tabIndex={-1}
        style={{ width, height, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
      />
    </div>
  );
}

export function AppStage({ tpl }: { tpl: GalleryTemplate }) {
  return (
    <div className="f-td-stage">
      <div className="f-td-phone-stage">
        <ScaledFrame src={`${apiBase()}${tpl.preview_url || `/templates/${tpl.id}/preview`}`} title={tpl.title} width={480} height={300} />
      </div>
    </div>
  );
}

/** Site sections or app screens, under the preview. */
export function PartList({ title, items, kind }: { title: string; items: string[]; kind: "section" | "screen" }) {
  if (!items.length) return null;
  return (
    <section className="f-td-sub-section">
      <h2 className="f-td-sub">{title}</h2>
      <div className="f-td-pages">
        {items.map((name, i) => (
          <div key={name}>
            <Glyph name={kind === "section" ? "layout" : "smartphone"} size="sm" />
            {name.replace(/([a-z])([A-Z])/g, "$1 $2")}
            <small>{kind === "section" ? `#${name.toLowerCase()}` : String(i + 1).padStart(2, "0")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ codelab */

export function CodelabStage({ tpl, detail }: { tpl: GalleryTemplate; detail: TemplateDetail }) {
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const codelab = detail.codelab;
  const [index, setIndex] = useState(0);
  const env = useMemo(() => {
    const base = defaultEnv(resolveCodelabLocale(locale));
    return { ...base, assetUrl: (path: string) => templateMediaUrl(tpl.id, path), storageKey: `forge-gallery-${tpl.id}` };
  }, [locale, tpl.id]);
  if (!codelab) return null;
  const steps = codelab.steps;
  const step = steps[index];
  const pct = Math.round(((index + 1) / steps.length) * 100);
  const vars = {
    "--bg": "var(--f-bg-deep)",
    "--fg": "var(--f-text)",
    "--muted": "var(--f-muted)",
    "--accent": "#EB6118",
    "--surface": "var(--f-surface)",
    "--border": "var(--f-line)",
    "--font-body": "var(--f-font)",
  } as CSSProperties;

  return (
    <div className="f-td-stage">
      <div className="f-td-cl">
        <nav className="f-td-cl-steps" aria-label={t("lndTdSteps")}>
          <h2>{t("lndTdSteps")}</h2>
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i < index ? "done" : undefined}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              <span className="num">{i < index ? <Glyph name="check" size="xs" /> : i + 1}</span>
              <span>
                {s.title || s.id}
                <small>{t("lndTdMinutes").replace("{n}", String(s.minutes))}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="f-td-cl-main">
          <div className="f-td-cl-head">
            <span>{t("lndTdStepOf").replace("{a}", String(index + 1)).replace("{b}", String(steps.length))}</span>
            <span>
              <Glyph name="clock" size="sm" />
              {t("lndTdMinutes").replace("{n}", String(step.minutes))}
            </span>
          </div>
          <div className="f-td-cl-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="f-td-cl-body fcl-root" style={vars} data-scheme={resolvedTheme} data-embedded="">
            <style>{CODELAB_CSS}</style>
            <RenderEnvProvider value={env}>
              <CodelabMarkdown markdown={detail.steps?.[step.id] ?? ""} />
            </RenderEnvProvider>
          </div>
          {detail.files?.length ? (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t("lndTdFiles")}</h3>
              <div className="f-td-files">
                {detail.files.map((f) => (
                  <div key={f}>
                    <Glyph name="file" size="sm" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="f-td-cl-nav">
            <Button variant="ghost" size="sm" icon="arrow-left" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              {t("lndTdPrevStep")}
            </Button>
            <Button size="sm" iconEnd="arrow-right" disabled={index === steps.length - 1} onClick={() => setIndex(index + 1)}>
              {t("lndTdNextStep")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ design system */

type DsTab = "colors" | "type" | "components" | "voice";

export function DesignSystemStage({ tpl, doc }: { tpl: GalleryTemplate; doc: DesignSystemDoc }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<DsTab>("colors");
  const colors = colorEntries(doc);
  const map = Object.fromEntries(colors.map((c) => [c.name, c.value]));
  const display = fontFamily(doc, "display");
  const body = fontFamily(doc, "body");
  useEffect(() => ensureFonts([display, body]), [display, body]);
  const { base, ratio } = typeScale(doc);
  const sizes = Object.entries(scaleSizes(base, ratio)).reverse();
  const voice = guidance(doc, "voice");
  const logo = (doc as { logo?: { src?: string } }).logo?.src;
  const style = {
    ...cssVars(doc),
    background: map.bg ?? "#fff",
    color: map.fg ?? "#111",
    fontFamily: `"${body}", system-ui, sans-serif`,
  } as CSSProperties;
  const tabs: { id: DsTab; label: string }[] = [
    { id: "colors", label: t("lndTdColors") },
    { id: "type", label: t("lndTdType") },
    { id: "components", label: t("lndTdComponents") },
    { id: "voice", label: t("lndTdVoice") },
  ];
  const initials = doc.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="f-td-stage" style={style}>
      <div className="f-td-ds">
        <div className="f-td-ds-hero">
          <span className="f-td-ds-logo">
            {logo ? (
              <img src={templateMediaUrl(tpl.id, logo)} alt="" />
            ) : (
              <span className="f-td-ds-mono" style={{ background: map.accent, color: map.bg }}>
                {initials}
              </span>
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: `"${display}", serif`, fontSize: 28, margin: 0 }}>{doc.name}</h2>
            {doc.description ? <p style={{ opacity: 0.75, fontSize: 14, maxWidth: "46ch" }}>{doc.description}</p> : null}
          </div>
        </div>
        <div className="f-td-ds-tabs" role="tablist" aria-label={tpl.title}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`f-ds-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`f-ds-panel-${item.id}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`f-ds-panel-${tab}`} aria-labelledby={`f-ds-tab-${tab}`}>
          {tab === "colors" ? (
            <div className="f-td-ds-colors">
              {colors.map((c) => (
                <div className="f-td-ds-color" key={c.name}>
                  <i style={{ background: c.value }} />
                  <div>
                    <b>{c.name}</b>
                    <span>{c.value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "type" ? (
            <div className="f-td-ds-type">
              {sizes.map(([name, px], i) => (
                <div className="row" key={name}>
                  <small>
                    {name} · {px}px
                  </small>
                  <div style={{ fontSize: px, fontFamily: `"${i < 3 ? display : body}", serif` }}>
                    {i < 3 ? doc.name : doc.description || doc.name}
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "components" ? (
            <ComponentShowcase vars={cssVars(doc)} components={(doc as { components?: string[] }).components} />
          ) : (
            <div className="f-td-ds-voice">
              {voice.summary ? <p style={{ fontSize: 17 }}>{voice.summary}</p> : null}
              <div className="f-td-dodont">
                <div style={{ background: "color-mix(in srgb, #22C55E 14%, transparent)" }}>
                  <b>{t("lndTdDo")}</b>
                  <ul>
                    {voice.do.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: "color-mix(in srgb, #EF4444 14%, transparent)" }}>
                  <b>{t("lndTdDont")}</b>
                  <ul>
                    {voice.dont.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
