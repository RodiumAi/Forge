# Design charter

## Template
- id: glacier-travel
- name: Glacier Expeditions

## Colors
- --bg: #061621
- --fg: #e8f4fb
- --muted: #7ba3b8
- --accent: #0ea5e9

Support tokens: `--bg-raise: #0b2231` (cards, booking band), `--line: rgba(232, 244, 251, 0.12)` (borders, dividers).

## Typography
- Font stack (`--sans`): -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif. Body 16px, line-height 1.6, antialiased.
- Hero title: clamp(42px, 7.5vw, 92px), weight 800, line-height 1.02, letter-spacing -0.02em; last line in accent.
- Section titles: clamp(28px, 4.2vw, 48px), weight 800, line-height 1.1. Booking title clamp(32px, 5vw, 56px). Stat values clamp(34px, 5vw, 56px) in accent.
- Card and timeline titles: 17px to 20px, weight 700. Supporting copy 13px to 17px in `--muted`.
- Eyebrows, grades, day labels: 11px to 13px, uppercase, letter-spacing 0.1em to 0.24em, accent color.

## Spacing & radius
- Gutter: `--gutter: clamp(20px, 6vw, 88px)` on every band.
- Sections: clamp(64px, 9vw, 130px) vertical padding; booking clamp(70px, 10vw, 140px).
- Gaps: 22px in card grids, 36px in the footer, 14px between CTAs, 40px between timeline steps.
- Radius: 8px buttons and inputs, 14px cards, 6px grade badges, 50% timeline dots.
- Breakpoints: mobile first, `min-width: 561px`, `861px` and `1081px` (grids go 1, 2 then 3 or 4 columns).

## Tone
Epic, calm, trustworthy. The voice of a guide who has done this a hundred times: awe without hype, safety without fuss.

## Do / Don't
- Do keep the full-screen photographic hero under a dark gradient veil.
- Do keep hover-zoom on destination cards and the vertical dotted itinerary timeline.
- Do use glacier blue (#0ea5e9) as the only accent on the deep navy base.
- Don't brighten the background; the photography must carry the light.
- Don't use warm colors anywhere except neutral skin tones inside photos.

## Images
- Hero: https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=70 (snowy mountain range)
- Destination — Patagonia Icefield: https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=70 (starry mountain night)
- Destination — Svalbard: https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1200&q=70 (misty peak)
- Destination — Vatnajökull: https://images.unsplash.com/photo-1478827536114-da961b7f86d2?auto=format&fit=crop&w=1200&q=70 (blue ice cave)
- Destination — Karakoram: https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=70 (high alpine ridge)
- Guides band: https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=70 (climbers on glacier)
- Guide 1: https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=70
- Guide 2: https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=70
- Guide 3: https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
