# Design charter

## Template
- id: holo-portfolio
- name: Holo Portfolio — Meta Morph

## Colors
- --bg: #050507
- --fg: #f4f4f5
- --muted: #8b8b96
- --accent: #22d3ee

## Typography
- Font stack: `"Segoe UI", system-ui, -apple-system, sans-serif` (no web fonts), body line-height 1.6, antialiased.
- Display: hero title `clamp(3rem, 11vw, 8.5rem)` weight 900, line-height 0.95, tracking -0.03em; contact title `clamp(2.4rem, 8vw, 6rem)`.
- Section titles: `clamp(2rem, 5.4vw, 3.6rem)` weight 800, line-height 1.05, tracking -0.02em; project title `clamp(1.8rem, 3.6vw, 2.8rem)` weight 800.
- Body: 1rem lead copy, 0.92rem project copy, 0.85rem and 0.82rem card copy and skill rows; card headings 1.15rem (services) and 1.05rem (process); hero stats 1.5rem weight 800.
- Labels: uppercase, 0.7rem to 0.8rem, letter-spacing 0.1em to 0.3em (pills, tags, hero tag, index numbers, press marquee); logo 0.95rem weight 800 with 0.14em tracking.

## Spacing & radius
- Sections: 6rem vertical padding (hero 4rem, contact 8rem) with 3rem side padding, 1.4rem below 961px. Breakpoints are mobile-first at 561px and 961px.
- Grids: cards 1.4rem apart, thumbnails 1rem, about columns 4rem (2.4rem stacked), section title to grid 3rem.
- Padding: services 2.4rem 2rem, process steps 2.2rem 1.8rem, project body 2.6rem 2.4rem, pills 0.4rem 1rem.
- Radius: cards and images 1.2rem, thumbnails 0.8rem, pills, tags and skill bars 999px, arrow buttons fully round (3.6rem).

## Tone
Bold, electric, futuristic. Huge type, confident short lines, everything glows against near-black. Iridescent cyan/magenta/violet gradients animate slowly.

## Do / Don't
- Do keep the signature effects: animated gradient display titles, holographic card sheen (background-position + hue-rotate), neon tag pills, grain overlay via CSS data-URI.
- Do use giant arrows and index numbers as navigation cues between sections.
- Don't use light backgrounds, serif fonts, or pastel colors.
- Don't hotlink external assets other than the approved Unsplash photos; noise uses an inline data-URI.

## Images
- Project: https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=70 (retro tech)
- Project: https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=70 (neon circuitry)
- Project: https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1200&q=70 (abstract 3D render)
- Project: https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&q=70 (gradient fluid)
- About: https://images.unsplash.com/photo-1617042375876-a13e36732a04?auto=format&fit=crop&w=1200&q=70 (studio setup)

Reuse these Unsplash URLs; do not hotlink other domains.
