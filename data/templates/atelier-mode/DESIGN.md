# Design charter

## Template
- id: atelier-mode
- name: Atelier Mode — Maison Vernet

## Colors
- --bg: #f8f6f2
- --fg: #141210
- --muted: #8a8177
- --accent: #9a7b4f

Support tokens: `--line: #e4dfd6` (hairlines), `#f1ede5` (newsletter band), `#efe9df` and `#cfc8bc` (text on ink).

## Typography
- Serif (`--serif`): Georgia, "Times New Roman", serif, weight 400, for h1 to h3, the brand, marquee and years.
- Sans (`--sans`): "Segoe UI", system-ui, -apple-system, sans-serif for body copy, line-height 1.6.
- Hero title: clamp(2.4rem, 6vw, 4.6rem), letter-spacing 0.06em, line-height 1.08.
- Section titles: clamp(1.8rem, 3.6vw, 2.8rem), letter-spacing 0.08em; heritage clamp(1.7rem, 3vw, 2.5rem); newsletter clamp(1.6rem, 3vw, 2.4rem).
- Card titles: 1rem to 1.1rem serif, letter-spacing 0.06em to 0.12em.
- Brand: 1.15rem, letter-spacing 0.42em (0.95rem / 0.24em on phones).
- Micro-labels: 0.65rem to 0.72rem uppercase, letter-spacing 0.18em to 0.32em. Body copy 0.82rem to 0.95rem.

## Spacing & radius
- Gutters: 3rem on desktop, 1.4rem on phones and tablets.
- Sections: 6rem vertical (lookbook, shop, newsletter), 5rem (services, journal, heritage copy); 3rem to 4rem on small screens.
- Grid gaps: 2rem (1.4rem for products on small screens); section heads sit 3.5rem above their grid.
- Radius: none. Every edge stays square; separation comes from 1px hairlines.
- Breakpoints: mobile first, `min-width: 561px` (brand, 2-column products) and `min-width: 961px` (desktop topbar, offset lookbook, multi-column grids).

## Tone
Editorial, restrained, haute couture. Long thin serif headlines with wide letter-spacing, short whispered copy, black on ivory with a single gold accent.

## Do / Don't
- Do keep the structure: hairline topbar, full-bleed hero, marquee band, offset lookbook grid, minimal product cards with prices, heritage split section, footer.
- Do use uppercase micro-labels with 0.2em+ letter-spacing and generous whitespace.
- Don't add rounded corners, drop shadows or bright colors; everything stays sharp, ivory and gold.
- Don't crowd the layout — negative space is the luxury.

## Images
- Hero: https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=70 (fashion editorial)
- Lookbook: https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=70 (couture dress)
- Lookbook: https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=70 (model in coat)
- Lookbook: https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=70 (women fashion group)
- Heritage: https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=70 (garment rail)

Reuse these Unsplash URLs; do not hotlink other domains.
