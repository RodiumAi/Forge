# Design charter

## Template
- id: synthwave-music
- name: Neon Nights

## Colors
- --bg: #16003b
- --fg: #fdf3ff
- --muted: #a78bca
- --accent: #ff2975

Secondary neon: #2de2e6 (cyan) for glows, borders and the floor grid.
Deep night: #0d0026 (`--deep`) for alternating bands, the floor and the footer.

## Typography
- Font stack (`--font`): -apple-system, BlinkMacSystemFont, "Segoe UI", "Arial Black", Arial, sans-serif. Body line-height 1.6, antialiased.
- Hero title: clamp(3rem, 11vw, 7.5rem), weight 900, line-height 0.92, letter-spacing 0.04em, pink and cyan glow shadows.
- Centered section titles: clamp(1.6rem, 4vw, 2.6rem), weight 900, letter-spacing 0.2em, flanked by cyan gradient lines.
- Left section titles: clamp(1.3rem, 3vw, 1.9rem), weight 900, letter-spacing 0.12em. Signup title: clamp(1.5rem, 3.6vw, 2.3rem).
- Card titles: 1.2rem / 900. Body copy 0.88rem to 1rem in `--muted`.
- Labels, nav, buttons: uppercase, 0.72rem to 0.95rem, weight 700 to 900, letter-spacing 0.06em to 0.5em.

## Spacing & radius
- Page gutter: 5vw. Section padding: 64px to 90px vertical (about 40px top, 90px bottom).
- Gaps: 16px to 26px in rows and nav, 32px to 56px between cards and under section titles.
- Buttons: 11px 22px (lg 14px 30px, sm 7px 16px), 2px neon border.
- Radius: square corners everywhere; only the sun, vinyl and its label are round (50%).
- Breakpoints: mobile first, `min-width: 641px` (nav links, tracklist plays) and `min-width: 961px` (multi-column grids).

## Tone
Nostalgic, electric, cinematic, cool. 80s references welcome; keep copy short and moody.

## Do / Don't
- Do keep the gradient sky (violet to pink), the striped CSS sun and the rotateX perspective floor grid in the hero.
- Do keep the 3D vinyl slide-out on album card hover.
- Do keep pink #ff2975 / cyan #2de2e6 neon glows (text-shadow / box-shadow).
- Don't use flat white backgrounds anywhere; every section stays in the night palette.
- Don't replace CSS-drawn elements (sun, grid, vinyl) with images.

## Images
- Album art 1: https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=70 (dj mixer)
- Album art 2: https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=70 (neon dj)
- Album art 3: https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=70 (concert stage)
- Live section: https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=70 (concert crowd)

Reuse these Unsplash URLs; do not hotlink other domains.
