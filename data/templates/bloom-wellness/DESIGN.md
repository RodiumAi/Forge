# Design charter

## Template
- id: bloom-wellness
- name: Bloom Wellness — Bloom Studio

## Colors
- --bg: #fdfaf8
- --fg: #3d3734
- --muted: #9b8f88
- --accent: #b76e79

Support tokens: `--rose: #f7e8e8` and `--sage: #dce8dd` (page and tile gradients), `--card: #ffffff`, `--leaf: #8fae8f` (leaf icons), dashed dividers `#eadfd8`.

## Typography
- Serif: Georgia, "Times New Roman", serif, weight 400, line-height 1.2 for h1 to h3, the logo, prices and step numbers.
- Sans: "Segoe UI", system-ui, -apple-system, sans-serif for body copy, line-height 1.65.
- Hero title: clamp(2.2rem, 4.6vw, 3.4rem) with an italic accent word.
- Section titles: clamp(1.7rem, 3.4vw, 2.5rem); ritual clamp(1.7rem, 3.2vw, 2.4rem); visit clamp(1.6rem, 3vw, 2.2rem).
- Card titles: 1.05rem to 1.5rem serif. Body copy 0.82rem to 0.95rem in `--muted`.
- Eyebrows: 0.72rem uppercase, letter-spacing 0.24em to 0.26em, accent color.

## Spacing & radius
- Section padding: `4rem 1.6rem 5rem` (hero `5rem 1.6rem 6rem`, `3rem 1.4rem 4rem` on small screens).
- Gaps: 1.6rem in card grids, 3rem to 3.5rem between split columns, 0.6rem to 1.4rem in rows.
- Radius: `--radius: 2.2rem` for cards, 3rem for hero and visit images, 999px for pills and buttons, 1.1rem to 1.2rem for icon tiles.
- Shadow: `--shadow: 0 18px 50px rgba(120, 100, 95, 0.12)` everywhere.
- Breakpoint: mobile first, desktop layout from `min-width: 961px`.

## Tone
Serene, soft, nurturing. Gentle sentences, calm rhythm, everything breathes. Powder rose (#f7e8e8) and sage (#dce8dd) pastel gradients over warm off-white.

## Do / Don't
- Do keep the structure: pill navbar, gradient hero, treatments grid with prices, weekly class schedule, numbered ritual steps, testimonials, footer.
- Do use very rounded shapes (border-radius 2rem+), diffuse soft shadows and lots of air.
- Don't use sharp corners, dark backgrounds, or saturated colors.
- Don't compress spacing — whitespace is part of the calm.

## Images
- Hero: https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=70 (spa stones and towels)
- Treatment: https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=70 (facial treatment)
- Treatment: https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=70 (massage)
- Ritual: https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=70 (calm interior)
- Studio: https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=70 (spa pool)

Reuse these Unsplash URLs; do not hotlink other domains.
