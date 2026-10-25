"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { TemplateThumb } from "@/components/templates/TemplateThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { KindBadge } from "@/components/ui/KindBadge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { normalizeKind } from "@/lib/kinds";
import { TEMPLATE_PLAN_NAMES, useTemplateLock } from "@/lib/template-access";

import { DeckThumb } from "./DeckThumb";

/** Only one deck plays at a time on the page: starting a card stops the previous one. */
let stopPlaying: (() => void) | null = null;

function coarsePointer(): boolean {
  try {
    return window.matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

export type TemplateCardProps = {
  template: GalleryTemplate;
  /** Detail page. Without it (and without onClick) the card is not interactive. */
  href?: string;
  /** Opens a preview or forks; used when there is no `href`. */
  onClick?: () => void;
  /** Stagger index for the entrance animation. */
  index?: number;
  /** Second line under the title; defaults to the slide count for decks, else the description. */
  subtitle?: ReactNode;
  /** Hover pill label (defaults to "Utiliser ce modèle"). */
  useLabel?: string;
  /** Shows "Création..." on the pill and disables the card. */
  busy?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Template card of the galleries (landing paper band, in-app templates, the
 * overview picks): 16:9 thumbnail, title, subtitle and kind badge. Slide decks
 * play their real slides on hover and keyboard focus (on touch screens, while
 * the card sits in the middle of the viewport); other kinds show their
 * preview.html capture.
 */
export function TemplateCard({
  template,
  href,
  onClick,
  index = 0,
  subtitle,
  useLabel,
  busy,
  disabled,
  className,
}: TemplateCardProps) {
  const { t } = useI18n();
  const kind = normalizeKind(template.kind);
  const isDeck = kind === "slides";
  const locked = useTemplateLock(template);
  const [playing, setPlaying] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const [deckMissing, setDeckMissing] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  const stop = useCallback(() => setPlaying(false), []);
  const play = useCallback(() => {
    if (!isDeck || deckMissing) return;
    if (stopPlaying && stopPlaying !== stop) stopPlaying();
    stopPlaying = stop;
    setPlaying(true);
  }, [isDeck, deckMissing, stop]);
  const end = useCallback(() => {
    if (stopPlaying === stop) stopPlaying = null;
    setPlaying(false);
  }, [stop]);

  useEffect(() => () => {
    if (stopPlaying === stop) stopPlaying = null;
  }, [stop]);

  // Touch screens have no hover: play the deck that sits in the middle of the viewport.
  useEffect(() => {
    if (!isDeck || typeof IntersectionObserver === "undefined" || !coarsePointer()) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.75) play();
          else end();
        }),
      { threshold: [0, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isDeck, play, end]);

  const sub =
    subtitle ??
    (isDeck && slideCount
      ? `${t("uiSlidesN").replace("{n}", String(slideCount))}`
      : template.description);

  const thumb = (
    <div className="f-thumb">
      {isDeck && !deckMissing ? (
        <DeckThumb
          templateId={template.id}
          playing={playing}
          onIndex={setSlideIndex}
          onCount={setSlideCount}
          onMissing={() => setDeckMissing(true)}
        />
      ) : (
        <TemplateThumb template={template} viewportWidth={480} viewportHeight={270} className="f-thumb-site" />
      )}
      {isDeck && slideCount ? (
        <span className="f-slide-count">
          <Glyph name="presentation" size="xs" />
          {slideCount}
        </span>
      ) : null}
      {locked ? (
        <span className="f-plan-lock" title={t("apTplLockedTitle").replace("{plan}", TEMPLATE_PLAN_NAMES[locked])}>
          <Glyph name="lock" size="xs" />
          {TEMPLATE_PLAN_NAMES[locked]}
        </span>
      ) : null}
      <div className="f-thumb-overlay">
        {isDeck && slideCount ? (
          <div className="f-dots" aria-hidden>
            {Array.from({ length: Math.min(slideCount, 14) }, (_, i) => (
              <i key={i} className={i === slideIndex % Math.min(slideCount, 14) ? "on" : undefined} />
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="f-use">
          <Glyph name="wand" size="sm" />
          {busy ? t("uiForking") : (useLabel ?? t("uiUseTemplate"))}
        </span>
      </div>
    </div>
  );

  const meta = (
    <div className="f-tcard-meta">
      <div style={{ minWidth: 0 }}>
        <h3>{template.title}</h3>
        <div className="f-tcard-sub">{sub}</div>
      </div>
      <KindBadge kind={kind} />
    </div>
  );

  const shared = {
    className: cx("f-tcard", playing && "is-playing", busy && "is-busy", className),
    style: { "--i": String(index) } as CSSProperties,
    onMouseEnter: play,
    onMouseLeave: end,
    onFocus: play,
    onBlur: end,
    "data-template-id": template.id,
  };

  if (href && !disabled) {
    return (
      <Link
        {...shared}
        ref={(el) => {
          rootRef.current = el;
        }}
        href={href}
        aria-busy={busy || undefined}
      >
        {thumb}
        {meta}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        {...shared}
        ref={(el) => {
          rootRef.current = el;
        }}
        type="button"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={onClick}
      >
        {thumb}
        {meta}
      </button>
    );
  }
  return (
    <div
      {...shared}
      ref={(el) => {
        rootRef.current = el;
      }}
    >
      {thumb}
      {meta}
    </div>
  );
}
