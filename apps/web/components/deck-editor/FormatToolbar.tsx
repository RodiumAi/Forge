"use client";

/**
 * Text formatting bar above the canvas when one text element is selected.
 * Font, size, alignment and line height apply to the whole element (its
 * `style`); bold, italic, underline and color apply to the whole element too,
 * or to the selected words while the text is being edited, where links and
 * lists are also available.
 */

import { useMemo, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, PencilLine, Underline } from "lucide-react";
import { fontChoices, type FontCategory, type ThemeTokens } from "@/components/deck-player";
import { colorTokens } from "./fields";
import type { TextElement } from "./model";
import type { DeckT } from "./strings";
import { ROLE_SIZES, type TextCommands, type TextMarks } from "./text-style";
import { colorToCss, cssToColor, safeLink } from "./text-model";

const SIZES = [14, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 96, 120, 160];
const LINE_HEIGHTS = [0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75, 2];
const FONT_GROUPS: [FontCategory, "fontGroupSans" | "fontGroupSerif" | "fontGroupDisplay" | "fontGroupMono"][] = [
  ["sans", "fontGroupSans"],
  ["serif", "fontGroupSerif"],
  ["display", "fontGroupDisplay"],
  ["mono", "fontGroupMono"],
];

/** Where a font choice applies. */
export type FontScope = "text" | "slide" | "deck";
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
  const choices = useMemo(() => fontChoices(), []);
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
      <select
        className="de-format-font"
        aria-label={t("font")}
        title={t("font")}
        value={fontValue}
        disabled={disabled}
        onChange={(e) => chooseFont(e.target.value)}
        style={style.family ? { fontFamily: `"${style.family}", sans-serif` } : undefined}
      >
        <option value="">{t("font")}</option>
        <optgroup label={t("fontGroupTheme")}>
          <option value="role:display">{t("fontDisplay")}</option>
          <option value="role:body">{t("fontBody")}</option>
          <option value="role:mono">{t("fontMono")}</option>
        </optgroup>
        {FONT_GROUPS.map(([category, label]) => (
          <optgroup key={category} label={t(label)}>
            {choices[category].map((family) => (
              <option key={family} value={`family:${family}`}>
                {family}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
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
          <option value="slide">{t("fontScopeSlide")}</option>
          <option value="deck">{t("fontScopeDeck")}</option>
        </select>
      ) : null}
      <input
        className="de-format-size"
        type="number"
        min={6}
        max={400}
        aria-label={t("size")}
        title={t("size")}
        list="de-sizes"
        value={size}
        disabled={disabled}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value) && value >= 6 && value <= 400) onStyle({ size: value });
        }}
      />
      <datalist id="de-sizes">
        {SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
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
      <select
        aria-label={t("lineHeight")}
        title={t("lineHeight")}
        value={String(style.lineHeight ?? 1.2)}
        disabled={disabled}
        onChange={(e) => onStyle({ lineHeight: Number(e.target.value) })}
      >
        {[...new Set([...LINE_HEIGHTS, style.lineHeight ?? 1.2])].sort((a, b) => a - b).map((lh) => (
          <option key={lh} value={String(lh)}>
            {lh}
          </option>
        ))}
      </select>
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
