"use client";

/**
 * The living brand panel beside every auth form: real Forge templates on a
 * stepped stage. The front card plays (decks advance slide by slide, sites
 * show their live preview), the two cards behind it are the next ones in
 * line, and the whole stack moves on every few seconds.
 *
 * Purely visual: nothing in it navigates away from the form, so the cards are
 * not links. It still has a pause button (WCAG 2.2.2), and with reduced
 * motion it shows one still template and never rotates.
 */

import { useEffect, useMemo, useState } from "react";

import { STEPS_PATH } from "@/components/landing/LandingHero";
import { TemplateThumb } from "@/components/templates/TemplateThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { DeckThumb } from "@/components/templates/DeckThumb";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { KindBadge } from "@/components/ui/KindBadge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { kindOf, usePublicTemplates } from "@/lib/public-templates";

/** Order of the showcase: a deck, a site, a deck, an app... Missing ids are skipped. */
const SHOWCASE_IDS = [
  "slides-product-launch",
  "lumen-wallet",
  "slides-travel",
  "aurora-ai",
  "slides-fundraising",
  "glacier-travel",
  "slides-annual-report",
  "vinyl-music",
];

/** How long each template stays in front. */
const STEP_MS = 6500;

const POINTS: { glyph: GlyphName; key: MessageKey }[] = [
  { glyph: "sparkles", key: "lndAuthPoint1" },
  { glyph: "eye", key: "lndAuthPoint2" },
  { glyph: "github", key: "lndAuthPoint3" },
];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function Shot({ tpl, playing }: { tpl: GalleryTemplate; playing: boolean }) {
  const [missing, setMissing] = useState(false);
  if (kindOf(tpl) === "slides" && !missing) {
    return <DeckThumb templateId={tpl.id} playing={playing} onMissing={() => setMissing(true)} />;
  }
  return (
    <TemplateThumb template={tpl} viewportWidth={480} viewportHeight={270} className="f-thumb-site" />
  );
}

export function AuthShowcase() {
  const { t, locale } = useI18n();
  const { templates } = usePublicTemplates(locale);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => setStill(prefersReducedMotion()), []);

  const items = useMemo(() => {
    if (!templates?.length) return [];
    const picked = SHOWCASE_IDS.map((id) => templates.find((tpl) => tpl.id === id)).filter(
      Boolean,
    ) as GalleryTemplate[];
    return picked.length >= 3 ? picked : templates.slice(0, 6);
  }, [templates]);

  const running = !paused && !still && items.length > 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [running, items.length]);

  const at = (offset: number) => (items.length ? items[(index + offset) % items.length] : null);
  const front = at(0);
  const kind = front ? kindOf(front) : null;

  return (
    <aside className="f-auth-panel f-theme-dark" aria-label={t("lndAuthPanelLabel")}>
      <div className="f-auth-panel-bg" aria-hidden>
        <div className="grid" />
        <svg className="steps" viewBox="0 0 1000 1000">
          <path fill="currentColor" d={STEPS_PATH} />
        </svg>
        <svg className="steps small" viewBox="0 0 1000 1000">
          <path fill="currentColor" d={STEPS_PATH} />
        </svg>
      </div>

      <div className="f-auth-panel-top">
        <span className="f-auth-panel-eyebrow">
          <i aria-hidden />
          {t("lndAuthPanelEyebrow")}
        </span>
        {items.length > 1 && !still ? (
          <IconButton
            size="sm"
            className="f-auth-panel-pause"
            icon={paused ? "play" : "pause"}
            label={paused ? t("lndAuthPanelPlay") : t("lndAuthPanelPause")}
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          />
        ) : null}
      </div>

      <p className="f-auth-panel-title">{t("lndAuthPitch")}</p>

      <div className="f-auth-stage" aria-hidden>
        {front ? (
          <>
            {[2, 1].map((offset) => {
              const tpl = at(offset);
              return tpl && items.length > offset ? (
                <div key={`${tpl.id}-${offset}`} className={cx("f-auth-shot", `is-back-${offset}`)}>
                  <Shot tpl={tpl} playing={false} />
                </div>
              ) : null;
            })}
            <div key={front.id} className="f-auth-shot is-front">
              <Shot tpl={front} playing={!paused && !still} />
            </div>
          </>
        ) : (
          <div className="f-auth-shot is-front">
            <div className="f-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />
          </div>
        )}
      </div>

      <div className="f-auth-caption">
        {front && kind ? (
          <>
            <KindBadge kind={kind} />
            <span className="f-auth-caption-title">{front.title}</span>
          </>
        ) : (
          <span className="f-auth-caption-title">&nbsp;</span>
        )}
        {items.length > 1 ? (
          <span className="f-auth-progress" aria-hidden>
            {items.map((tpl, i) => (
              <i
                key={tpl.id}
                className={cx(i === index && "is-on", i === index && running && "is-run")}
                style={i === index ? { animationDuration: `${STEP_MS}ms` } : undefined}
              />
            ))}
          </span>
        ) : null}
      </div>

      <ul className="f-auth-points">
        {POINTS.map((p) => (
          <li key={p.key}>
            <span className="ico" aria-hidden>
              <Glyph name={p.glyph} size="sm" />
            </span>
            {t(p.key)}
          </li>
        ))}
      </ul>
    </aside>
  );
}
