/**
 * The Forge icon drawn inline, for the "By Forge" pill of published decks and
 * codelabs. Those players are bundled on their own and exported as standalone
 * HTML, so the mark cannot be an <img> pointing at /brand.
 */

export function ForgeMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="100 100 1000 1000" aria-hidden="true" focusable="false" style={{ display: "block", flex: "none" }}>
      <path d="M100 100L360 360L575 360L575 575L625 625L840 625L840 840L1100 1100L1100 100Z" fill="#EB6118" />
    </svg>
  );
}

/** Pill colours shared by every "By Forge" badge (same as the landing). */
export const BY_FORGE_PILL = {
  background: "#1C1F26",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;
