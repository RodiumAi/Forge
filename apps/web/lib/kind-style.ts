/**
 * How each project kind looks in the redesign: colour, glyph and label keys.
 * One place for every card, badge, filter and palette row.
 */

import type { GlyphName } from "@/components/ui/glyph";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProjectKindId } from "@/lib/kinds";

export type KindStyle = {
  /** Flat colour (dot, icon tile). */
  color: string;
  glyph: GlyphName;
  /** Short label ("Site web", "Slides"). */
  labelKey: MessageKey;
};

export const KIND_STYLES: Record<ProjectKindId, KindStyle> = {
  web: { color: "#3B82F6", glyph: "globe", labelKey: "uiKindWeb" },
  mobile: { color: "#14B8A6", glyph: "smartphone", labelKey: "uiKindMobile" },
  slides: { color: "#EB6118", glyph: "presentation", labelKey: "uiKindSlides" },
  codelab: { color: "#22C55E", glyph: "book", labelKey: "uiKindCodelab" },
  design_system: { color: "#8B5CF6", glyph: "palette", labelKey: "uiKindDesignSystem" },
};

export function kindStyle(kind: ProjectKindId): KindStyle {
  return KIND_STYLES[kind] ?? KIND_STYLES.web;
}
