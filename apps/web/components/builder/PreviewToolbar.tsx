"use client";

import { useState } from "react";

import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { PreviewTool } from "./types";

type Props = {
  tool: PreviewTool | null;
  onToolChange: (tool: PreviewTool | null) => void;
  /** Phone viewport: start collapsed so the bar does not cover the app chrome. */
  defaultCollapsed?: boolean;
};

const TOOLS: { id: PreviewTool; glyph: GlyphName; labelKey: MessageKey }[] = [
  { id: "select", glyph: "cursor", labelKey: "bdToolSelect" },
  { id: "text", glyph: "textcur", labelKey: "bdToolText" },
  { id: "comment", glyph: "msg", labelKey: "bdToolComment" },
  { id: "image", glyph: "image", labelKey: "bdToolImage" },
];

/** Floating tool bar over the preview: select an element, edit text, comment, replace an image. */
export function PreviewToolbar({ tool, onToolChange, defaultCollapsed = false }: Props) {
  const { t } = useI18n();
  // Collapsing parks it as a bottom-right button so it stops covering the preview.
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <button
        type="button"
        className="f-bd-tools-restore"
        title={t("previewToolbarShow")}
        aria-label={t("previewToolbarShow")}
        aria-expanded={false}
        onClick={() => setCollapsed(false)}
      >
        <Glyph name="wand" />
      </button>
    );
  }

  return (
    <div className="f-bd-tools" role="toolbar" aria-label={t("bdToolsLabel")}>
      {TOOLS.map((item) => {
        const active = tool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={t(item.labelKey)}
            aria-pressed={active}
            onClick={() => onToolChange(active ? null : item.id)}
          >
            <Glyph name={item.glyph} size="sm" />
            <span className="lbl">{t(item.labelKey)}</span>
          </button>
        );
      })}
      <span className="sep" aria-hidden />
      <button
        type="button"
        title={t("previewToolbarHide")}
        aria-label={t("previewToolbarHide")}
        aria-expanded
        onClick={() => {
          // Leave no active tool behind an invisible toolbar.
          onToolChange(null);
          setCollapsed(true);
        }}
      >
        <Glyph name="chevron-right" size="sm" />
      </button>
    </div>
  );
}
