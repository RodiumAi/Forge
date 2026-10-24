"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@/styles/forge/pages.css";

import { useForkTemplate } from "@/components/app/useForkTemplate";
import { useToast } from "@/components/app/useToast";
import { SlideView } from "@/components/deck-player";
import { AppShell } from "@/components/shell/AppShell";
import { APP_ROUTES } from "@/components/shell/nav";
import { SiteThumb } from "@/components/SiteThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { Chip } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { KindBadge } from "@/components/ui/KindBadge";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { getToken } from "@/lib/api";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { normalizeKind, useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import { ensureTemplates, getCachedTemplates } from "@/lib/lists-cache";
import { getSessionSnapshot } from "@/lib/session-cache";
import { loadTemplateDeck, type TemplateDeck } from "@/lib/template-deck";

const FAV_KEY = "forge_template_favorites_v1";
const KIND_ORDER: ProjectKindId[] = ["slides", "web", "mobile", "codelab", "design_system"];

const FORMAT: Record<ProjectKindId, { glyph: GlyphName; key: MessageKey }[]> = {
  slides: [{ glyph: "presentation", key: "apTdFormatSlides" }],
  web: [
    { glyph: "globe", key: "apTdFormatWeb" },
    { glyph: "monitor", key: "apTdFormatWebResponsive" },
  ],
  mobile: [
    { glyph: "smartphone", key: "apTdFormatMobile" },
    { glyph: "layers", key: "apTdFormatMobilePwa" },
  ],
  codelab: [{ glyph: "book", key: "apTdFormatCodelab" }],
  design_system: [{ glyph: "palette", key: "apTdFormatDs" }],
};

function readFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** The real deck: big slide, arrows, slide strip, arrow keys. */
function DeckStage({ deck }: { deck: TemplateDeck }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const n = deck.slides.length;
  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable='true']") || document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") go(index + 1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  useEffect(() => {
    const strip = stripRef.current;
    const button = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !button) return;
    strip.scrollTo({ left: button.offsetLeft - strip.clientWidth / 2 + button.offsetWidth / 2, behavior: "smooth" });
  }, [index]);

  const slide = deck.slides[index];
  return (
    <>
      <div className="f-td-stage is-deck" data-td-stage="">
        <div className="f-deck-slide">
          <SlideView slide={slide} deck={deck.deck} tokens={deck.tokens} mode="thumbnail" assetUrl={deck.assetUrl} />
        </div>
        <button type="button" className="nav prev" aria-label={t("apPrev")} onClick={() => go(index - 1)}>
          <Glyph name="chevron-left" />
        </button>
        <button type="button" className="nav next" aria-label={t("apNext")} onClick={() => go(index + 1)}>
          <Glyph name="chevron-right" />
        </button>
        <span className="count" aria-live="polite">
          {index + 1} / {n}
        </span>
      </div>
      <div className="f-td-strip" ref={stripRef} role="tablist" aria-label={t("apSlides")}>
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-current={i === index}
            aria-label={`${t("apSlide")} ${i + 1}`}
            onClick={() => go(i)}
          >
            <span className="n">{i + 1}</span>
            <SlideView slide={s} deck={deck.deck} tokens={deck.tokens} mode="thumbnail" assetUrl={deck.assetUrl} />
          </button>
        ))}
      </div>
    </>
  );
}

export default function AppTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id || "");
  const router = useRouter();
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<TemplateDeck | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const { fork, busyId, error } = useForkTemplate();
  const [toast, notify] = useToast();

  useEffect(() => {
    // Signed-out visitors get the public template page.
    if (!getToken()) {
      router.replace(`/gallery/${encodeURIComponent(id)}`);
      return;
    }
    setFavs(readFavs());
    const warm = getCachedTemplates(locale);
    if (warm) {
      setTemplates(warm as GalleryTemplate[]);
      setLoading(false);
    }
    let alive = true;
    void ensureTemplates(locale)
      .then((list) => alive && setTemplates(list as GalleryTemplate[]))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, locale, router]);

  const tpl = templates.find((x) => x.id === id) ?? null;
  const kind = normalizeKind(tpl?.kind);
  const isDeck = kind === "slides";

  useEffect(() => {
    setDeck(null);
    if (!tpl || !isDeck) return;
    let alive = true;
    void loadTemplateDeck(tpl.id).then((data) => alive && setDeck(data));
    return () => {
      alive = false;
    };
  }, [tpl, isDeck]);

  useEffect(() => {
    if (tpl) document.title = `${tpl.title} · Forge by RodiumAi`;
  }, [tpl]);

  const related = useMemo(
    () => templates.filter((x) => x.id !== id && normalizeKind(x.kind) === kind).slice(0, 6),
    [templates, id, kind],
  );
  const firstOfKind = useMemo(() => {
    const out: Partial<Record<ProjectKindId, string>> = {};
    for (const x of templates) {
      const k = normalizeKind(x.kind);
      if (!out[k]) out[k] = x.id;
    }
    return out;
  }, [templates]);

  function toggleFav() {
    const next = new Set(favs);
    const on = !next.has(id);
    if (on) next.add(id);
    else next.delete(id);
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
    } catch {
      /* storage denied: the star still toggles here */
    }
    notify(on ? t("apFavAdded") : t("apFavRemoved"), "star");
  }

  async function copyLink() {
    const url = `${window.location.origin}/gallery/${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(t("apLinkCopied"), "link");
    } catch {
      notify(url, "link");
    }
  }

  function fullscreen() {
    const stage = document.querySelector<HTMLElement>("[data-td-stage]");
    void stage?.requestFullscreen?.().catch(() => undefined);
  }

  const palette = [tpl?.bg, tpl?.accent].filter((c): c is string => Boolean(c && /^#/.test(c)));
  const gateNeedsKey = error === t("createNeedsKey");
  const gateNeedsRodi = error === t("createNeedsRodi");

  return (
    <AppShell active="templates" title={t("uiNavTemplates")}>
      {toast}
      <nav className="f-crumbs" aria-label={t("apBreadcrumb")}>
        <Link href={APP_ROUTES.templates}>{t("apTemplatesTitle")}</Link>
        <Glyph name="chevron-right" size="sm" />
        <Link href={`${APP_ROUTES.templates}?kind=${kind}`}>{t(kindStyle(kind).labelKey)}</Link>
        <Glyph name="chevron-right" size="sm" />
        <span aria-current="page">{tpl?.title ?? id}</span>
      </nav>
      <nav className="f-kind-switch" aria-label={t("apFilterKind")}>
        {KIND_ORDER.filter((k) => enabledKinds.includes(k) && firstOfKind[k]).map((k) => (
          <Link key={k} className="f-fchip" href={`${APP_ROUTES.templates}/${encodeURIComponent(firstOfKind[k] as string)}`} aria-current={k === kind ? "page" : undefined}>
            <Glyph name={kindStyle(k).glyph} size="sm" />
            {t(kindStyle(k).labelKey)}
          </Link>
        ))}
      </nav>

      {!tpl ? (
        <section className="f-panel f-empty">
          <h2>{loading ? t("loading") : t("apTemplateNotFound")}</h2>
          {!loading ? (
            <Button href={APP_ROUTES.templates} icon="arrow-left">
              {t("apAllTemplates")}
            </Button>
          ) : null}
        </section>
      ) : (
        <div className="f-td-grid">
          <div style={{ minWidth: 0 }}>
            {isDeck && deck ? (
              <DeckStage deck={deck} />
            ) : (
              <div className="f-td-stage" data-td-stage="">
                <SiteThumb
                  src={tpl.preview_url || `/templates/${tpl.id}/preview`}
                  viewportWidth={480}
                  viewportHeight={300}
                  title={tpl.title}
                  className="f-thumb-site"
                />
              </div>
            )}
          </div>
          <aside className="f-td-side">
            <KindBadge kind={kind} />
            <h1>{tpl.title}</h1>
            <div className="f-td-format">
              {FORMAT[kind].map((f) => (
                <span key={f.key}>
                  <Glyph name={f.glyph} size="sm" />
                  {t(f.key).replace("{n}", String(deck?.slides.length ?? ""))}
                </span>
              ))}
            </div>
            <div className="f-td-author">
              <img src="/brand/forge/forge-app-icon-dark.svg" alt="" width={28} height={28} />
              <span>
                {t("apTdBy")} <b>{t("apTdForgeTeam")}</b> · {t("apTdFree")}
              </span>
            </div>
            <div className="f-actions-row">
              <Button icon="wand" loading={busyId === tpl.id} onClick={() => void fork(tpl)}>
                {busyId === tpl.id ? t("uiForking") : t("uiUseTemplate")}
              </Button>
              <IconButton
                icon="star"
                label={favs.has(id) ? t("apUnfavorite").replace("{name}", tpl.title) : t("apFavorite").replace("{name}", tpl.title)}
                aria-pressed={favs.has(id)}
                onClick={toggleFav}
              />
              <Popover align="end" label={t("apMoreActionsShort")} trigger={<IconButton icon="more" label={t("apMoreActionsShort")} />}>
                {(close) => (
                  <>
                    <MenuItem icon="link" onClick={() => { close(); void copyLink(); }}>
                      {t("apCopyLink")}
                    </MenuItem>
                    <MenuItem icon="expand" onClick={() => { close(); fullscreen(); }}>
                      {t("apFullscreen")}
                    </MenuItem>
                  </>
                )}
              </Popover>
            </div>
            {error ? (
              <p className="f-error" role="alert">
                {error}{" "}
                {gateNeedsKey ? <Link href={`${APP_ROUTES.settings}#rodiumai`}>{t("openSettings")}</Link> : null}
                {gateNeedsRodi ? (
                  <a href={rodiumRechargeUrl(getSessionSnapshot()?.profile?.rodium_sub)} target="_blank" rel="noreferrer">
                    {t("rechargeRodi")}
                  </a>
                ) : null}
              </p>
            ) : null}
            <Button variant="ghost" icon="sparkles" href={`${APP_ROUTES.home}#create`} block>
              {t("apTdAi")}
            </Button>
            <p className="f-td-desc">{tpl.description}</p>
            {palette.length ? (
              <div className="f-palette-line" aria-hidden>
                {palette.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
            ) : null}
            {tpl.tags?.length ? (
              <div className="f-td-tags">
                {tpl.tags.slice(0, 8).map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            ) : null}
            <div className="f-td-plan">
              <Glyph name="lock" size="sm" />
              <span>{t("apTdPlanNote")}</span>
            </div>
          </aside>
        </div>
      )}

      {related.length ? (
        <section style={{ marginTop: 48 }}>
          <div className="f-paper f-paper-band">
            <div className="f-section-title" style={{ marginTop: 0 }}>
              <div>
                <h2 style={{ color: "var(--f-paper-ink)" }}>{t("apTdSeeMore")}</h2>
                <p style={{ color: "var(--f-paper-muted)" }}>{t("apTdSeeMoreSub")}</p>
              </div>
            </div>
            <div className="f-tgrid">
              {related.map((x, i) => (
                <TemplateCard key={x.id} template={x} index={i} href={`${APP_ROUTES.templates}/${encodeURIComponent(x.id)}`} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
