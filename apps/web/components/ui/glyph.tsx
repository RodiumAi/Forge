import type { CSSProperties } from "react";

import { GLYPH_PATHS, type GlyphName } from "./glyph-paths";

export type { GlyphName } from "./glyph-paths";
export { GLYPH_PATHS } from "./glyph-paths";

export type GlyphSize = "xs" | "sm" | "md" | "lg";

type GlyphProps = {
  name: GlyphName;
  /** xs 14px, sm 16px, md 20px (default), lg 24px. */
  size?: GlyphSize;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; without it the glyph is decorative (aria-hidden). */
  label?: string;
  strokeWidth?: number;
};

const SIZE_CLASS: Record<GlyphSize, string> = { xs: "f-ico-xs", sm: "f-ico-sm", md: "f-ico", lg: "f-ico-lg" };

/**
 * The redesign's icon set: the mockup's own 24 x 24 line glyphs, so the app
 * matches it stroke for stroke. Lucide (components/ui/icon.tsx) stays for the
 * screens that still use it.
 */
export function Glyph({ name, size = "md", className, style, label, strokeWidth = 1.75 }: GlyphProps) {
  const cls = className ? `${SIZE_CLASS[size]} ${className}` : SIZE_CLASS[size];
  return (
    <svg
      className={cls}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      // Static path markup from glyph-paths.ts, never user input.
      // nosemgrep: rodiumai-dangerous-innerhtml-without-sanitize-import, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      dangerouslySetInnerHTML={{ __html: GLYPH_PATHS[name] ?? GLYPH_PATHS.file }}
    />
  );
}
