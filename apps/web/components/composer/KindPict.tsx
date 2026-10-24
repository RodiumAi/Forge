import type { HomeTileId } from "@/components/home/home-kinds";

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/* 80 x 48 line pictograms of the starting types, from the redesign mockup. Static markup. */
const PICT: Record<HomeTileId, string> = {
  blank: '<rect x="18" y="4" width="44" height="40" rx="6" stroke-dasharray="4 4"/><path d="M40 16v16M32 24h16"/>',
  web: '<rect x="6" y="4" width="68" height="40" rx="5"/><path d="M6 12h68"/><circle cx="11" cy="8" r=".8" fill="currentColor"/><circle cx="15" cy="8" r=".8" fill="currentColor"/><path d="M14 22h22M14 28h16"/><rect x="44" y="18" width="22" height="18" rx="3"/>',
  mobile: '<rect x="22" y="3" width="17" height="42" rx="4"/><rect x="43" y="7" width="15" height="34" rx="4" opacity=".55"/><path d="M28 9h5M26 16h9M26 21h6"/>',
  slides: '<rect x="8" y="6" width="56" height="32" rx="4"/><path d="M15 15h4M15 21h24M15 27h16"/><path d="M68 12v30H16" opacity=".5"/>',
  codelab: '<rect x="6" y="4" width="68" height="40" rx="5"/><path d="M26 4v40"/><circle cx="14" cy="13" r="2.5"/><circle cx="14" cy="23" r="2.5"/><circle cx="14" cy="33" r="2.5"/><path d="m40 18-6 6 6 6M54 18l6 6-6 6M50 16l-6 16"/>',
  design_system: '<circle cx="16" cy="16" r="8"/><circle cx="30" cy="16" r="8"/><circle cx="23" cy="30" r="8"/><path d="M46 36V12l7 0c5 0 8 3 8 6.5s-3 6.5-8 6.5h-7M54 25l9 11"/>',
  pitch_deck: '<rect x="8" y="6" width="64" height="36" rx="4"/><path d="M18 34l10-10 8 6 14-14M44 16h6v6"/>',
  social_carousel: '<rect x="30" y="6" width="28" height="28" rx="4" opacity=".45"/><rect x="24" y="10" width="28" height="28" rx="4" opacity=".7"/><rect x="18" y="14" width="28" height="28" rx="4"/>',
  landing_page: '<rect x="22" y="3" width="36" height="42" rx="4"/><path d="M28 11h24M28 17h14"/><rect x="28" y="23" width="24" height="9" rx="2"/><path d="M28 38h10M42 38h10"/>',
  onboarding: '<rect x="31" y="3" width="18" height="42" rx="4"/><circle cx="40" cy="18" r="6"/><path d="M35 30h10M36 38h8"/><circle cx="20" cy="24" r="1.5" fill="currentColor"/><circle cx="60" cy="24" r="1.5" fill="currentColor"/>',
  tutorial: '<path d="M14 10h4M14 24h4M14 38h4"/><path d="M26 10h36M26 24h28M26 38h32"/><path d="M16 13v8M16 27v8" stroke-dasharray="2 3"/>',
  palette: '<rect x="8" y="10" width="12" height="28" rx="3"/><rect x="22" y="10" width="12" height="28" rx="3" opacity=".7"/><rect x="36" y="10" width="12" height="28" rx="3" opacity=".45"/><path d="M56 36l7-24 7 24M58.5 28h9"/>',
};

/** Line pictogram of a starting type (composer tiles, empty states). */
export function KindPict({ id, className }: { id: HomeTileId; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 48"
      aria-hidden="true"
      focusable="false"
      // Static pictogram markup above, never user input.
      dangerouslySetInnerHTML={{ __html: `<g ${S}>${PICT[id] ?? PICT.blank}</g>` }}
    />
  );
}
