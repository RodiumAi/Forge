# Design charter

## Template
- id: quantum-consult
- name: Quantum Consult — Quantum Partners

## Colors
- --bg: #0b1c33
- --fg: #eef2f7
- --muted: #8ba0ba
- --accent: #d97757

Supporting tokens: --bg2 #0e2340 (raised panels, contact band), --line rgba(139,160,186,0.22)
(hairline rules), chart fills --c1 #d97757, --c2 #eef2f7, --c3 #5d7ba1, --c4 #33507a.

## Typography
- Font stack: "Segoe UI", system-ui, -apple-system, sans-serif (no web fonts).
- Body: 1rem, line-height 1.6. Headings: weight 600, line-height 1.15, letter-spacing -0.01em.
- Hero h1: clamp(2.2rem, 5vw, 3.8rem). Section h2: clamp(1.5rem, 3vw, 2.2rem). Card h3: 1.02 to 1.05rem.
- Key figures: clamp(2.4rem, 4.4vw, 3.6rem), weight 700, letter-spacing -0.02em, line-height 1.
- Labels: 0.65 to 0.75rem uppercase with wide tracking (0.14em to 0.28em), copper or muted.
- Supporting copy: 0.78 to 0.9rem in --muted.

## Spacing & radius
- Containers: max-width 1240px, side padding 1.4rem on mobile, 3rem from 1001px.
- Sections: 5rem vertical padding, separated by 1px --line rules.
- Grids: 1px gaps on a --line background for the practice grid, 2rem gaps for cards, 4rem between chart and contact columns.
- Buttons: padding 0.85rem 1.9rem.
- Radius: 2px on buttons, inputs and the nav pill; 50% only for the donut chart.
- Breakpoints (mobile first): 561px (two-column grids), 1001px (desktop grid and inline nav).

## Tone
Serious, dense, authoritative. Declarative sentences, no exclamation marks, numbers do the persuading. Midnight blue with a single copper accent.

## Do / Don't
- Do keep a strict swiss grid: hairline rules, aligned columns, numbered sections.
- Do use massive figures (2.4B$, 340+) and pure-CSS charts (conic-gradient donut, bar rows).
- Don't use rounded corners beyond 2-4px, playful icons, or gradients other than chart fills.
- Don't lighten the palette; the page stays midnight blue throughout.

## Images
- Case study: https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=70 (corporate towers)
- Case study: https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=70 (strategy documents)
- Leadership: https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70 (executive portrait)
- Leadership: https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70 (executive portrait)
- Leadership: https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=70 (executive portrait)

Reuse these Unsplash URLs; do not hotlink other domains.
