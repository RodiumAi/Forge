/**
 * Text box style shared by the inline editor and the toolbar, mirror of the
 * player's text element, plus the toolbar <-> editor interface. Kept apart
 * from TextEditor so the toolbar does not pull TipTap into the main bundle.
 */

import type { CSSProperties } from "react";
import { colorRef, fontRef } from "@/components/deck-player";
import type { TextElement } from "./model";

export type TextMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link: boolean;
  bulletList: boolean;
  orderedList: boolean;
  color: string | null;
};

/** What the formatting toolbar can do while a text is being edited. */
export type TextCommands = {
  toggleBold(): void;
  toggleItalic(): void;
  toggleUnderline(): void;
  setLink(href: string | null): void;
  toggleBulletList(): void;
  toggleOrderedList(): void;
  setColor(css: string | null): void;
};

export const ROLE_SIZES: Record<string, number> = { title: 96, subtitle: 48, heading: 64, body: 32, caption: 22, quote: 40, label: 20 };

/** Same box style as the player's text element. */
export function textBoxStyle(element: TextElement): CSSProperties {
  const style = element.style ?? {};
  const role = element.role ?? "body";
  const font = style.font ?? (role === "title" || role === "heading" || role === "subtitle" ? "display" : "body");
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: style.valign === "middle" ? "center" : style.valign === "bottom" ? "flex-end" : "flex-start",
    fontFamily: fontRef(font),
    fontSize: style.size ?? ROLE_SIZES[role] ?? 32,
    fontWeight: style.weight ?? (role === "title" || role === "heading" ? 700 : 400),
    fontStyle: style.italic || role === "quote" ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    textTransform: style.uppercase ? "uppercase" : undefined,
    color: colorRef(style.color ?? "--fg"),
    textAlign: style.align ?? "left",
    lineHeight: style.lineHeight ?? 1.2,
    letterSpacing: style.letterSpacing,
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  };
}

