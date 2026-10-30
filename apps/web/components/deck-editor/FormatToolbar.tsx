"use client";

/**
 * Text formatting bar above the canvas when one text element is selected.
 * Font, size, alignment and spacing apply to the whole element (its
 * `style`); bold, italic, underline and color apply to the whole element too,
 * or to the selected words while the text is being edited, where links and
 * lists are also available.
 */

import { useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  PencilLine,
  Underline,
  UnfoldVertical,
} from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import type { ThemeTokens } from "@/components/deck-player";
import { firstFamily } from "@/components/deck-player/fonts";
import { colorTokens } from "./fields";
import { FontPicker, TEXT_ROLES } from "./FontPicker";
import type { TextElement } from "./model";
import type { DeckT } from "./strings";
import { ROLE_SIZES, type TextCommands, type TextMarks } from "./text-style";
import { colorToCss, cssToColor, safeLink } from "./text-model";

const SIZES = [14, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 96, 120, 160];

/** Font size: minus, the value (typing or picking from the list), plus. */
function SizeControl({ value, onChange, disabled, t }: { value: number; onChange: (size: number) => void; disabled?: boolean; t: DeckT }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const set = (v: number) => onChange(Math.min(400, Math.max(6, Math.round(v))));
  const prev = [...SIZES].reverse().find((s) => s < value) ?? Math.max(6, value - 1);
  const next = SIZES.find((s) => s > value) ?? Math.min(400, value + 1);
  const commit = () => {
    const v = Number((draft ?? "").replace(",", "."));
    if (draft !== null && Number.isFinite(v) && v > 0) set(v);
    setDraft(null);
  };
  return (
    <span className="de-size" role="group" aria-label={t("size")}>
      <button type="button" className="de-size-step" aria-label={t("sizeDown")} title={t("sizeDown")} disabled={disabled || value <= 6} onClick={() => set(prev)}>
        <Minus size={14} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="de-size-value"
        aria-label={t("size")}
        title={t("size")}
        disabled={disabled}
        value={draft ?? String(Math.round(value * 10) / 10)}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          commit();
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(null);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            set(e.key === "ArrowUp" ? next : prev);
          }
        }}
      />
      {open ? (
        <ul className="de-size-list" role="listbox" aria-label={t("size")}>
          {SIZES.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={s === value}
                className={s === value ? "is-active" : undefined}
                // Pick before the input loses focus.
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft(null);
                  set(s);
                  setOpen(false);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="de-size-step" aria-label={t("sizeUp")} title={t("sizeUp")} disabled={disabled || value >= 400} onClick={() => set(next)}>
        <Plus size={14} aria-hidden />
      </button>
    </span>
  );
}

/** A slider with its value field, as in the spacing menu. */
function SpacingSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="de-spacing-row">
      <span className="de-spacing-label">{label}</span>
      <div className="de-spacing-control">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={{ ["--de-range" as string]: `${((value - min) / (max - min)) * 100}%` }}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
        <input
          type="text"
          inputMode="decimal"
          className="de-spacing-value"
          aria-label={label}
          disabled={disabled}
          value={draft ?? String(Number(value.toFixed(2)))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = Number((draft ?? "").replace(",", "."));
            if (draft !== null && Number.isFinite(v)) onChange(clamp(v));
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

/** Where a font choice applies. */
export type FontScope = "text" | "role" | "slide" | "deck";
/** A theme role ("role:display") or an explicit family ("family:Inter"). */
export type FontChoice = { font?: "display" | "body" | "mono"; family?: string };

export function parseFontChoice(value: string): FontChoice {
  if (value.startsWith("family:")) return { family: value.slice(7) };
  if (value === "role:display" || value === "role:body" || value === "role:mono") {
    return { font: value.slice(5) as FontChoice["font"] };
  }
  return {};
}

export function FormatToolbar({
  element,
  tokens,
  editing,
  commands,
  marks,
  onStyle,
  onFont,
  onRole,
  onEdit,
  t,
  disabled,
}: {
  element: TextElement;
  tokens: ThemeTokens;
  editing: boolean;
  commands: TextCommands | null;
  marks: TextMarks | null;
  onStyle: (patch: Record<string, unknown>) => void;
  /** Font choice for the text, its slide or the whole deck. */
  onFont?: (choice: FontChoice, scope: FontScope) => void;
  /** Sets the text role (Text styles tab of the font menu). */
  onRole?: (role: string | undefined) => void;
  onEdit: () => void;
  t: DeckT;
  disabled?: boolean;
}) {
  const style = element.style ?? {};
  const role = element.role ?? "body";
  const size = style.size ?? ROLE_SIZES[role] ?? 32;
  const weight = style.weight ?? (role === "title" || role === "heading" ? 700 : 400);
  const inline = editing && commands;
  const active = (name: keyof TextMarks, fallback: boolean) => (inline ? !!marks?.[name] : fallback);
  const currentColor = inline ? cssToColor(marks?.color) : style.color;
  const [fontScope, setFontScope] = useState<FontScope>("text");
  const fontValue = style.family ? `family:${style.family}` : style.font ? `role:${style.font}` : "";
  const chooseFont = (value: string) => {
    const choice = parseFontChoice(value);
    if (onFont) onFont(choice, fontScope);
    else onStyle({ font: choice.font, family: choice.family });
  };

  const toggle = (name: "bold" | "italic" | "underline") => {
    if (inline) {
      if (name === "bold") commands.toggleBold();
      if (name === "italic") commands.toggleItalic();
      if (name === "underline") commands.toggleUnderline();
      return;
    }
    if (name === "bold") onStyle({ weight: weight >= 600 ? 400 : 700 });
    if (name === "italic") onStyle({ italic: !style.italic });
    if (name === "underline") onStyle({ underline: !style.underline });
  };

  const setColor = (color: string | undefined) => {
    if (inline) commands.setColor(color ? colorToCss(color) : null);
    else onStyle({ color });
  };

  const button = (label: string, on: boolean, onClick: () => void, icon: React.ReactNode, extra?: { disabled?: boolean }) => (
    <button
      type="button"
      className={`de-tool${on ? " is-active" : ""}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled || extra?.disabled}
      // Keep the editor's text selection when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <div className="de-format" role="toolbar" aria-label={t("style")}>
      {!editing ? button(t("editText"), false, onEdit, <PencilLine size={16} aria-hidden />) : null}
      <FontPicker
        value={fontValue}
        family={style.family ?? firstFamily(tokens[style.font === "mono" ? "--font-mono" : style.font === "body" ? "--font-body" : "--font-display"]) ?? undefined}
        tokens={tokens}
        onChange={chooseFont}
        role={element.role}
        onRole={onRole}
        disabled={disabled}
        t={t}
      />
      {onFont ? (
        <select
          className="de-format-scope"
          aria-label={t("fontScope")}
          title={t("fontScope")}
          value={fontScope}
          disabled={disabled}
          onChange={(e) => setFontScope(e.target.value as FontScope)}
        >
          <option value="text">{t("fontScopeText")}</option>
          <option value="role">
            {t("fontScopeRole").replace("{role}", t(TEXT_ROLES.find(([r]) => r === (element.role ?? "body"))?.[1] ?? "roleBody"))}
          </option>
          <option value="slide">{t("fontScopeSlide")}</option>
          <option value="deck">{t("fontScopeDeck")}</option>
        </select>
      ) : null}
      <SizeControl value={size} disabled={disabled} t={t} onChange={(v) => onStyle({ size: v })} />
      <span className="de-format-sep" />
      {button(t("bold"), active("bold", weight >= 600), () => toggle("bold"), <Bold size={16} aria-hidden />)}
      {button(t("italic"), active("italic", !!style.italic), () => toggle("italic"), <Italic size={16} aria-hidden />)}
      {button(t("underline"), active("underline", !!style.underline), () => toggle("underline"), <Underline size={16} aria-hidden />)}
      {button(
        t("linkText"),
        !!marks?.link,
        () => {
          if (!commands) return;
          const raw = window.prompt(t("linkPrompt"), "https://");
          if (raw === null) return;
          commands.setLink(safeLink(raw) ?? null);
        },
        <Link2 size={16} aria-hidden />,
        { disabled: !inline },
      )}
      {button(t("bulletList"), !!marks?.bulletList, () => commands?.toggleBulletList(), <List size={16} aria-hidden />, { disabled: !inline })}
      {button(t("orderedList"), !!marks?.orderedList, () => commands?.toggleOrderedList(), <ListOrdered size={16} aria-hidden />, {
        disabled: !inline,
      })}
      <span className="de-format-sep" />
      {(["left", "center", "right", "justify"] as const).map((a) => {
        const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : a === "right" ? AlignRight : AlignJustify;
        return (
          <span key={a}>
            {button(`${t("textAlign")}: ${a}`, (style.align ?? "left") === a, () => onStyle({ align: a }), <Icon size={16} aria-hidden />)}
          </span>
        );
      })}
      <Popover
        role="dialog"
        label={t("spacing")}
        width={300}
        className="de-spacing-pop"
        trigger={
          <button type="button" className="de-tool" title={t("spacing")} aria-label={t("spacing")} disabled={disabled}>
            <UnfoldVertical size={16} aria-hidden />
          </button>
        }
      >
        {() => (
          <div className="de-spacing">
            <SpacingSlider
              label={t("letterSpacingFull")}
              value={style.letterSpacing ?? 0}
              min={-20}
              max={100}
              step={0.5}
              disabled={disabled}
              onChange={(v) => onStyle({ letterSpacing: v || undefined })}
            />
            <SpacingSlider
              label={t("lineHeight")}
              value={style.lineHeight ?? 1.2}
              min={0.5}
              max={3}
              step={0.01}
              disabled={disabled}
              onChange={(v) => onStyle({ lineHeight: v })}
            />
            <div className="de-spacing-anchor">
              <span className="de-spacing-label">{t("anchorText")}</span>
              <span className="de-spacing-anchors" role="radiogroup" aria-label={t("anchorText")}>
                {(
                  [
                    ["top", "alignTop", AlignVerticalJustifyStart],
                    ["middle", "alignVMiddle", AlignVerticalJustifyCenter],
                    ["bottom", "alignBottom", AlignVerticalJustifyEnd],
                  ] as const
                ).map(([v, label, Icon]) => {
                  const active = (style.valign ?? "top") === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={t(label)}
                      title={t(label)}
                      className={`de-tool${active ? " is-active" : ""}`}
                      disabled={disabled}
                      onClick={() => onStyle({ valign: v === "top" ? undefined : v })}
                    >
                      <Icon size={16} aria-hidden />
                    </button>
                  );
                })}
              </span>
            </div>
          </div>
        )}
      </Popover>
      <span className="de-format-sep" />
      <span className="de-format-colors" role="group" aria-label={t("color")}>
        {colorTokens(tokens)
          .slice(0, 8)
          .map((sw) => (
            <button
              key={sw.name}
              type="button"
              className={`de-swatch de-swatch-sm${currentColor === sw.name ? " is-active" : ""}`}
              style={{ background: sw.value }}
              title={sw.name}
              aria-label={`${t("color")} ${sw.name}`}
              aria-pressed={currentColor === sw.name}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setColor(sw.name)}
            />
          ))}
      </span>
    </div>
  );
}
