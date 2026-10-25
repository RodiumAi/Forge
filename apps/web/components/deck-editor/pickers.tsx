"use client";

/**
 * Transition and animation catalogs (plan 5.3), with a preview on hover or
 * focus, like Canva: each tile plays its effect on a miniature.
 */

import type { CSSProperties } from "react";
import { ANIMATION_TYPES, DIRECTIONS, TRANSITION_TYPES, type Animation, type Transition } from "@/lib/contracts/forge-design";
import { Field, NumberField, SelectField } from "./fields";
import type { DeckLocale, DeckT } from "./strings";

/** A slide in miniature: a picture and "ABC", like Canva's tiles. */
function MiniSlide({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style}>
      <span className="de-mini-pic" />
      <span className="de-mini-abc">ABC</span>
    </span>
  );
}

/** Direction hint drawn over a tile (only where the move has one). */
const TILE_MARKS: Record<string, string> = {
  "t-push": "←",
  "t-slide": "←",
  "t-wipe": "→",
  "t-zoom-in": "⤢",
  "t-zoom-out": "⤡",
  "t-curtain": "↔",
  "a-rise": "↑",
  "a-drop": "↓",
  "a-slide": "→",
};

function TileMark({ preview }: { preview: string }) {
  const mark = TILE_MARKS[preview];
  return mark ? <span className="de-mini-mark">{mark}</span> : null;
}

const TRANSITION_LABELS: Record<DeckLocale, Record<(typeof TRANSITION_TYPES)[number], string>> = {
  fr: {
    none: "Aucune",
    fade: "Fondu",
    push: "Pousser",
    slide: "Glisser",
    wipe: "Balayer",
    "zoom-in": "Zoom avant",
    "zoom-out": "Zoom arrière",
    dissolve: "Dissolution",
    curtain: "Rideau",
    cube: "Cube",
    morph: "Morph",
  },
  en: {
    none: "None",
    fade: "Fade",
    push: "Push",
    slide: "Slide",
    wipe: "Wipe",
    "zoom-in": "Zoom in",
    "zoom-out": "Zoom out",
    dissolve: "Dissolve",
    curtain: "Curtain",
    cube: "Cube",
    morph: "Morph",
  },
};

const ANIMATION_LABELS: Record<DeckLocale, Record<(typeof ANIMATION_TYPES)[number], string>> = {
  fr: {
    appear: "Apparition",
    rise: "Montée",
    drop: "Descente",
    slide: "Glissement",
    pop: "Pop",
    zoom: "Zoom",
    typewriter: "Machine à écrire",
    "mask-reveal": "Révélation",
    bounce: "Rebond",
    pulse: "Pulsation",
  },
  en: {
    appear: "Appear",
    rise: "Rise",
    drop: "Drop",
    slide: "Slide in",
    pop: "Pop",
    zoom: "Zoom",
    typewriter: "Typewriter",
    "mask-reveal": "Mask reveal",
    bounce: "Bounce",
    pulse: "Pulse",
  },
};

const DIRECTION_LABELS: Record<DeckLocale, Record<(typeof DIRECTIONS)[number], string>> = {
  fr: { left: "Gauche", right: "Droite", up: "Haut", down: "Bas" },
  en: { left: "Left", right: "Right", up: "Up", down: "Down" },
};

const DIRECTED_TRANSITIONS = new Set(["push", "slide", "wipe", "curtain", "cube"]);

export function transitionLabel(locale: DeckLocale, type: (typeof TRANSITION_TYPES)[number]): string {
  return TRANSITION_LABELS[locale][type];
}

export function TransitionPicker({
  value,
  onChange,
  onApplyAll,
  t,
  locale,
  disabled,
}: {
  value: Transition | undefined;
  onChange: (value: Transition | undefined) => void;
  onApplyAll: () => void;
  t: DeckT;
  locale: DeckLocale;
  disabled?: boolean;
}) {
  const current = value?.type ?? "none";
  const set = (patch: Partial<Transition>) => {
    const next = { ...(value ?? { type: "none" }), ...patch } as Transition;
    if (next.type === "none" && !next.durationMs) onChange(undefined);
    else onChange(next);
  };
  return (
    <div className="de-picker">
      <div className="de-tiles" role="radiogroup" aria-label={t("transition")}>
        {TRANSITION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={current === type}
            className={`de-tile${current === type ? " is-active" : ""}`}
            disabled={disabled}
            onClick={() => (type === "none" ? onChange(undefined) : set({ type }))}
            data-preview={`t-${type}`}
          >
            <span className="de-tile-preview" aria-hidden>
              <MiniSlide className="de-mini de-mini-a" />
              <MiniSlide className="de-mini de-mini-b" style={{ "--de-dir": value?.direction ?? "left" } as CSSProperties} />
              <TileMark preview={`t-${type}`} />
            </span>
            <span className="de-tile-label">{TRANSITION_LABELS[locale][type]}</span>
          </button>
        ))}
      </div>
      {current !== "none" ? (
        <div className="de-row">
          <NumberField label={t("duration")} value={value?.durationMs ?? 600} min={0} max={5000} step={50} onChange={(v) => set({ durationMs: v })} disabled={disabled} />
          {DIRECTED_TRANSITIONS.has(current) ? (
            <SelectField
              label={t("direction")}
              value={value?.direction ?? ""}
              options={[{ value: "", label: "-" }, ...DIRECTIONS.map((d) => ({ value: d, label: DIRECTION_LABELS[locale][d] }))]}
              onChange={(v) => set({ direction: (v || undefined) as Transition["direction"] })}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}
      <button type="button" className="de-button de-button-ghost" onClick={onApplyAll} disabled={disabled}>
        {t("applyToAll")}
      </button>
    </div>
  );
}

export function AnimationPicker({
  value,
  onChange,
  t,
  locale,
  disabled,
}: {
  value: Animation | undefined;
  onChange: (value: Animation | undefined) => void;
  t: DeckT;
  locale: DeckLocale;
  disabled?: boolean;
}) {
  const set = (patch: Partial<Animation>) => onChange({ ...(value ?? { type: "appear", trigger: "on-click" }), ...patch } as Animation);
  return (
    <div className="de-picker">
      <div className="de-tiles" role="radiogroup" aria-label={t("animation")}>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          className={`de-tile${!value ? " is-active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(undefined)}
          data-preview="a-none"
        >
          <span className="de-tile-preview" aria-hidden>
            <MiniSlide className="de-mini de-mini-el" />
          </span>
          <span className="de-tile-label">{t("animationNone")}</span>
        </button>
        {ANIMATION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value?.type === type}
            className={`de-tile${value?.type === type ? " is-active" : ""}`}
            disabled={disabled}
            onClick={() => set({ type })}
            data-preview={`a-${type}`}
          >
            <span className="de-tile-preview" aria-hidden>
              <MiniSlide className="de-mini de-mini-el" />
              <TileMark preview={`a-${type}`} />
            </span>
            <span className="de-tile-label">{ANIMATION_LABELS[locale][type]}</span>
          </button>
        ))}
      </div>
      {value ? (
        <>
          <Field label={t("trigger")}>
            <select value={value.trigger} disabled={disabled} onChange={(e) => set({ trigger: e.target.value as Animation["trigger"] })}>
              <option value="on-enter">{t("triggerOnEnter")}</option>
              <option value="on-click">{t("triggerOnClick")}</option>
              <option value="after-previous">{t("triggerAfterPrevious")}</option>
            </select>
          </Field>
          <div className="de-row">
            <NumberField label={t("order")} value={value.order ?? 0} min={0} max={999} onChange={(v) => set({ order: Math.round(v) })} disabled={disabled} />
            <NumberField label={t("duration")} value={value.durationMs ?? 500} min={0} max={10000} step={50} onChange={(v) => set({ durationMs: Math.round(v) })} disabled={disabled} />
            <NumberField label={t("delay")} value={value.delayMs ?? 0} min={0} max={10000} step={50} onChange={(v) => set({ delayMs: Math.round(v) })} disabled={disabled} />
          </div>
          {value.type === "slide" ? (
            <SelectField
              label={t("direction")}
              value={value.direction ?? ""}
              options={[{ value: "", label: "-" }, ...DIRECTIONS.map((d) => ({ value: d, label: DIRECTION_LABELS[locale][d] }))]}
              onChange={(v) => set({ direction: (v || undefined) as Animation["direction"] })}
              disabled={disabled}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
