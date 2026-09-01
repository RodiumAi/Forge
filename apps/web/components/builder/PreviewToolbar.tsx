"use client";

import { useState } from "react";
import {
  BoxSelect,
  ChevronsRight,
  Image as ImageIcon,
  MessageSquare,
  Type,
  Wand2,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PreviewTool } from "./types";

type Props = {
  tool: PreviewTool | null;
  onToolChange: (tool: PreviewTool | null) => void;
};

const TOOLS: { id: PreviewTool; icon: typeof BoxSelect; labelKey: string }[] = [
  { id: "select", icon: BoxSelect, labelKey: "previewToolSelect" },
  { id: "text", icon: Type, labelKey: "previewToolText" },
  { id: "comment", icon: MessageSquare, labelKey: "previewToolComment" },
  { id: "image", icon: ImageIcon, labelKey: "previewToolImage" },
];

export function PreviewToolbar({ tool, onToolChange }: Props) {
  const { t } = useI18n();
  // Visible by default; collapsing parks it as a bottom-right pill so it stops
  // covering the page being previewed.
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        className="preview-toolbar-restore"
        title={t("previewToolbarShow")}
        aria-label={t("previewToolbarShow")}
        aria-expanded={false}
        onClick={() => setCollapsed(false)}
      >
        <Icon icon={Wand2} className="ui-icon-md" />
      </button>
    );
  }

  return (
    <div className="preview-toolbar" role="toolbar" aria-label={t("previewToolbar")}>
      {TOOLS.map((item) => {
        const active = tool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`preview-toolbar-btn${active ? " active" : ""}`}
            title={t(item.labelKey as "previewToolSelect")}
            aria-label={t(item.labelKey as "previewToolSelect")}
            aria-pressed={active}
            onClick={() => onToolChange(active ? null : item.id)}
          >
            <Icon icon={item.icon} className="ui-icon-md" />
          </button>
        );
      })}
      <span className="preview-toolbar-sep" aria-hidden />
      <button
        type="button"
        className="preview-toolbar-btn preview-toolbar-collapse"
        title={t("previewToolbarHide")}
        aria-label={t("previewToolbarHide")}
        aria-expanded
        onClick={() => {
          // Leave no active tool behind an invisible toolbar.
          onToolChange(null);
          setCollapsed(true);
        }}
      >
        <Icon icon={ChevronsRight} className="ui-icon-md" />
      </button>
    </div>
  );
}
