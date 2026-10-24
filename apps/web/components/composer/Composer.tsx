"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { visibleTiles, getTile, type HomeTileId } from "@/components/home/home-kinds";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { PROMPT_MAX_CHARS } from "@/lib/constants/prompt";
import type { DeckRatio } from "@/lib/create-project";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import type { ProjectKindId } from "@/lib/kinds";
import {
  attachmentName,
  attachmentPreviewUrl,
  PROMPT_FILE_ACCEPT,
  type PromptAttachment,
} from "@/lib/prompt-attachments";

import { DesignSystemMenu, type ComposerDesignSystem } from "./DesignSystemMenu";
import { KindPict } from "./KindPict";
import { ModelMenu } from "./ModelMenu";

/** A suggestion chip: short label, the full prompt it inserts, optional kind icon. */
export type ComposerSuggestion = { label: string; prompt: string; kind?: ProjectKindId };

export type { ComposerDesignSystem } from "./DesignSystemMenu";

export type ComposerHandle = {
  focus: () => void;
  /** Replaces the text and focuses the field. */
  setText: (text: string) => void;
};

/** Mockup copy of each starting tile (label + hint). The create flow keeps home-kinds' labels. */
const TILE_COPY: Record<HomeTileId, { label: MessageKey; hint: MessageKey }> = {
  blank: { label: "uiTileBlank", hint: "uiTileBlankHint" },
  web: { label: "uiTileWeb", hint: "uiTileWebHint" },
  mobile: { label: "uiTileMobile", hint: "uiTileMobileHint" },
  slides: { label: "uiTileSlides", hint: "uiTileSlidesHint" },
  codelab: { label: "uiTileCodelab", hint: "uiTileCodelabHint" },
  design_system: { label: "uiTileDs", hint: "uiTileDsHint" },
  pitch_deck: { label: "uiTilePitch", hint: "uiTilePitchHint" },
  social_carousel: { label: "uiTileCarousel", hint: "uiTileCarouselHint" },
  landing_page: { label: "uiTileLanding", hint: "uiTileLandingHint" },
  onboarding: { label: "uiTileOnboarding", hint: "uiTileOnboardingHint" },
  tutorial: { label: "uiTileTutorial", hint: "uiTileTutorialHint" },
  palette: { label: "uiTilePalette", hint: "uiTilePaletteHint" },
};

/** Document kinds that are new in Forge (the "Nouveau" tag on their tile). */
const NEW_TILES: ReadonlySet<HomeTileId> = new Set(["slides", "codelab", "design_system"]);

const KIND_PLACEHOLDER: Record<ProjectKindId, MessageKey> = {
  web: "uiPhWeb",
  mobile: "uiPhMobile",
  slides: "uiPhSlides",
  codelab: "uiPhCodelab",
  design_system: "uiPhDs",
};

const ROTATING: readonly MessageKey[] = ["uiPh1", "uiPh2", "uiPh3", "uiPh4", "uiPh5"];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Types the example prompts letter by letter in the placeholder, then erases them. */
function useTypewriter(active: boolean, phrases: readonly string[]): string {
  const [text, setText] = useState(phrases[0] ?? "");
  useEffect(() => {
    if (!active || !phrases.length) return;
    if (prefersReducedMotion()) {
      setText(phrases[0]);
      return;
    }
    let phrase = 0;
    let n = 0;
    let back = false;
    let timer = 0;
    const tick = () => {
      const full = phrases[phrase % phrases.length];
      if (!back) {
        n += 1;
        setText(full.slice(0, n));
        if (n >= full.length) {
          back = true;
          timer = window.setTimeout(tick, 2400);
          return;
        }
        timer = window.setTimeout(tick, 38);
      } else {
        n -= 2;
        setText(full.slice(0, Math.max(0, n)));
        if (n <= 0) {
          back = false;
          n = 0;
          phrase += 1;
          timer = window.setTimeout(tick, 250);
          return;
        }
        timer = window.setTimeout(tick, 16);
      }
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [active, phrases]);
  return text;
}

export type ComposerProps = {
  value: string;
  onChange: (next: string) => void;
  /** Enter or the send button, when there is text or a file and nothing is running. */
  onSubmit: () => void;

  files?: PromptAttachment[];
  onAddFiles?: (list: FileList) => void;
  onRemoveFile?: (id: string) => void;

  /** Selected starting tile; "blank" shows no chip (the kind is guessed). */
  tileId: HomeTileId;
  onTileChange: (id: HomeTileId) => void;
  /** Kinds this instance offers (useEnabledKinds): tiles of other kinds are hidden. */
  enabledKinds: readonly ProjectKindId[];
  /** Deck ratio chosen in the slides chip; defaults to the tile's own. */
  deckFormat?: DeckRatio;
  onDeckFormatChange?: (format: DeckRatio) => void;

  designSystems?: readonly ComposerDesignSystem[];
  designSystemId?: string | null;
  onDesignSystemChange?: (id: string | null) => void;
  /** Off when the design_system kind is switched off. */
  showDesignSystems?: boolean;
  manageDesignSystemsHref?: string;

  /** Optional code mode toggle (hidden without a handler). */
  codeMode?: boolean;
  onCodeModeChange?: (on: boolean) => void;

  /** Hides the model button (screens where the model is fixed). */
  hideModel?: boolean;
  /** Plans page for the model gate note. */
  upgradeHref?: string;

  busy?: boolean;
  /** Errors and gates shown above the text (file errors, credit gates). */
  alerts?: ReactNode;
  /**
   * Example prompts under the box: short chips (label and kind icon) whose
   * click fills the field with the full prompt. A plain string is both.
   */
  suggestions?: readonly (string | ComposerSuggestion)[];

  /** Starting type panel under the box (default on). */
  showKinds?: boolean;
  /** Panel open on mount (the overview keeps it closed). */
  kindsDefaultOpen?: boolean;
  /** Keyboard hint line; the right part defaults to the Free plan note. */
  hint?: boolean;
  hintRight?: ReactNode;
  /** No rotating placeholder (tests, compact screens). */
  staticPlaceholder?: boolean;
  /** `compact` is the builder chat size. */
  variant?: "hero" | "compact";
  className?: string;
};

/**
 * The composer of the redesign: the dark prompt card shared by the landing,
 * the overview and the builder. Controlled: the page owns the text, the files,
 * the tile and the design system, and does the create on `onSubmit` (see the
 * dashboard: createProjectWithAttachments with buildCreateRequest).
 */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  {
    value,
    onChange,
    onSubmit,
    files = [],
    onAddFiles,
    onRemoveFile,
    tileId,
    onTileChange,
    enabledKinds,
    deckFormat,
    onDeckFormatChange,
    designSystems = [],
    designSystemId = null,
    onDesignSystemChange,
    showDesignSystems = true,
    manageDesignSystemsHref,
    codeMode,
    onCodeModeChange,
    hideModel,
    upgradeHref,
    busy = false,
    alerts,
    suggestions = [],
    showKinds = true,
    kindsDefaultOpen = true,
    hint = true,
    hintRight,
    staticPlaceholder,
    variant = "hero",
    className,
  },
  ref,
) {
  const { t } = useI18n();
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kindsOpen, setKindsOpen] = useState(kindsDefaultOpen);
  const [dragging, setDragging] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      setText: (text: string) => {
        onChange(text);
        window.requestAnimationFrame(() => textareaRef.current?.focus());
      },
    }),
    [onChange],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, variant === "compact" ? 180 : 280)}px`;
  }, [value, variant]);

  const tile = getTile(tileId);
  const tiles = visibleTiles(enabledKinds);
  const mainTiles = tiles.filter((x) => !x.shortcut);
  const shortcutTiles = tiles.filter((x) => x.shortcut);
  const chosenKind = tile.kind && enabledKinds.includes(tile.kind) ? tile.kind : null;

  const rotating = useMemo(() => ROTATING.map((key) => t(key)), [t]);
  const animated = !chosenKind && !value && !staticPlaceholder && variant === "hero";
  const typed = useTypewriter(animated, rotating);
  const placeholder = chosenKind ? t(KIND_PLACEHOLDER[chosenKind]) : animated ? typed : rotating[0];

  const canSubmit = Boolean(value.trim() || files.length) && !busy;
  const format = deckFormat ?? tile.format ?? "16:9";

  function pickTile(next: HomeTileId) {
    onTileChange(next === tileId ? "blank" : next);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div className={cx("f-composer-root", className)}>
      <form
        className={cx("f-composer-wrap", variant === "compact" && "is-compact", dragging && "is-drop")}
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onDragOver={(event) => {
          if (!onAddFiles) return;
          event.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!onAddFiles) return;
          event.preventDefault();
          setDragging(false);
          if (!busy && event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files);
        }}
      >
        <div className="f-composer">
          <div className="f-composer-context">
            {chosenKind && tile.id !== "blank" ? (
              <span className="f-ctx-chip">
                <Glyph name={kindStyle(chosenKind).glyph} size="sm" />
                <span>{t(TILE_COPY[tile.id].label)}</span>
                {chosenKind === "slides" && onDeckFormatChange ? (
                  <>
                    <label className="f-sr-only" htmlFor={`${id}-fmt`}>
                      {t("uiFormat")}
                    </label>
                    <select
                      id={`${id}-fmt`}
                      value={format}
                      disabled={busy}
                      onChange={(event) => onDeckFormatChange(event.target.value as DeckRatio)}
                    >
                      {(["16:9", "4:3", "1:1"] as const).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <button type="button" aria-label={t("uiRemoveType")} disabled={busy} onClick={() => onTileChange("blank")}>
                  <Glyph name="x" size="sm" />
                </button>
              </span>
            ) : null}
            {files.map((file) => {
              const preview = attachmentPreviewUrl(file);
              const name = attachmentName(file);
              return (
                <span key={file.id} className="f-ctx-chip f-file-chip">
                  {preview && /^(blob:|data:image|https?:)/.test(preview) ? <img src={preview} alt="" /> : <Glyph name="file" size="sm" />}
                  <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  {onRemoveFile ? (
                    <button type="button" aria-label={`${t("uiRemoveFile")} ${name}`} onClick={() => onRemoveFile(file.id)}>
                      <Glyph name="x" size="sm" />
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
          {alerts ? <div className="f-composer-alerts">{alerts}</div> : null}
          {value.length > PROMPT_MAX_CHARS - 1000 ? (
            <p className={cx("f-composer-count", value.length >= PROMPT_MAX_CHARS && "at-limit")} aria-live="polite">
              {value.length.toLocaleString()} / {PROMPT_MAX_CHARS.toLocaleString()}
            </p>
          ) : null}
          <label className="f-sr-only" htmlFor={`${id}-prompt`}>
            {t("uiComposerLabel")}
          </label>
          <textarea
            id={`${id}-prompt`}
            ref={textareaRef}
            rows={3}
            value={value}
            maxLength={PROMPT_MAX_CHARS}
            placeholder={placeholder}
            disabled={busy}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSubmit) onSubmit();
              }
            }}
          />
          <div className="f-composer-bar">
            {onAddFiles ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={PROMPT_FILE_ACCEPT}
                  tabIndex={-1}
                  aria-hidden
                  style={{ display: "none" }}
                  onChange={(event) => {
                    if (event.target.files?.length) onAddFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="f-c-btn is-icon"
                  aria-label={t("uiAttach")}
                  title={t("uiAttachHint")}
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Glyph name="plus" />
                </button>
              </>
            ) : null}
            {showDesignSystems && onDesignSystemChange ? (
              <DesignSystemMenu
                options={designSystems}
                value={designSystemId}
                onChange={onDesignSystemChange}
                disabled={busy}
                manageHref={manageDesignSystemsHref}
              />
            ) : null}
            {onCodeModeChange ? (
              <button
                type="button"
                className="f-c-btn is-icon"
                aria-pressed={Boolean(codeMode)}
                aria-label={t("uiCodeMode")}
                title={t("uiCodeMode")}
                disabled={busy}
                onClick={() => onCodeModeChange(!codeMode)}
              >
                <Glyph name="code" />
              </button>
            ) : null}
            <span className="f-grow" />
            {hideModel ? null : <ModelMenu disabled={busy} upgradeHref={upgradeHref} />}
            <button
              type="submit"
              className={cx("f-send", busy && "is-busy")}
              disabled={!canSubmit}
              aria-label={busy ? t("uiSending") : t("uiSend")}
              aria-busy={busy || undefined}
            >
              <Glyph name={busy ? "refresh" : "arrow-up"} className={busy ? "f-spin" : undefined} />
            </button>
          </div>
        </div>
        {hint && variant === "hero" ? (
          <div className="f-composer-hint">
            <span className="f-kb">
              <kbd>{t("uiKeyEnter")}</kbd> {t("uiHintEnter")} · <kbd>{t("uiKeyShiftEnter")}</kbd> {t("uiHintShift")}
            </span>
            <span>{hintRight ?? t("uiHintFree")}</span>
          </div>
        ) : null}
      </form>

      {suggestions.length ? (
        <div className="f-composer-suggest" aria-label={t("uiSuggestions")}>
          {suggestions.map((item) => {
            const chip = typeof item === "string" ? { label: item, prompt: item } : item;
            return (
              <button
                key={chip.label}
                type="button"
                title={chip.prompt}
                disabled={busy}
                onClick={() => {
                  onChange(chip.prompt);
                  textareaRef.current?.focus();
                }}
              >
                {chip.kind ? (
                  <Glyph name={kindStyle(chip.kind).glyph} size="sm" style={{ color: kindStyle(chip.kind).color }} />
                ) : null}
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {showKinds && variant === "hero" ? (
        <div className="f-kinds">
          <button
            type="button"
            className="f-kinds-toggle"
            aria-expanded={kindsOpen}
            aria-controls={`${id}-kinds`}
            onClick={() => setKindsOpen((open) => !open)}
          >
            <Glyph name="chevron-down" size="sm" />
            <span>{t("uiChooseType")}</span>
          </button>
          <div className={cx("f-kinds-body", !kindsOpen && "is-closed")} id={`${id}-kinds`}>
            <div>
              <div className="f-kind-grid">
                {mainTiles.map((x) => (
                  <KindTile key={x.id} id={x.id} pressed={tileId === x.id && x.id !== "blank"} disabled={busy} onPick={pickTile} />
                ))}
                {shortcutTiles.length ? <div className="f-kind-sep">{t("uiShortcuts")}</div> : null}
                {shortcutTiles.map((x) => (
                  <KindTile key={x.id} id={x.id} pressed={tileId === x.id && x.id !== "blank"} disabled={busy} onPick={pickTile} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function KindTile({
  id,
  pressed,
  disabled,
  onPick,
}: {
  id: HomeTileId;
  pressed: boolean;
  disabled?: boolean;
  onPick: (id: HomeTileId) => void;
}) {
  const { t } = useI18n();
  const copy = TILE_COPY[id];
  return (
    <button type="button" className="f-kind-tile" aria-pressed={pressed} disabled={disabled} onClick={() => onPick(id)}>
      {NEW_TILES.has(id) ? <span className="f-badge f-badge-new">{t("uiNew")}</span> : null}
      <span className="f-pict">
        <KindPict id={id} />
      </span>
      <b>{t(copy.label)}</b>
      <small>{t(copy.hint)}</small>
    </button>
  );
}
