# Design charter

## Template
- id: mono-journal
- name: Monochrome Journal

## Colors
- --bg: #ffffff
- --fg: #0a0a0a
- --muted: #737373
- --accent: #dc2626

Supporting tokens: --rule #0a0a0a (black hairlines), #e5e5e5 for light inner rules, #d4d4d4 for
article numbers and arrows, #a3a3a3 for the quote citation.

## Typography
- Serif (body and headlines): Georgia, "Iowan Old Style", "Times New Roman", serif.
- Sans (labels, meta, nav, buttons): "Helvetica Neue", Helvetica, Arial, sans-serif.
- Body: line-height 1.65; hero columns 17px, essay text 18px, excerpts 16px.
- Wordmark: clamp(36px, 6vw, 64px), weight 700, letter-spacing 0.14em.
- Hero title: clamp(32px, 5vw, 56px), weight 700, line-height 1.18.
- Article titles: clamp(21px, 2.6vw, 28px). Pull quote: clamp(30px, 5vw, 58px) bold italic.
- Labels: sans 12 to 13px uppercase, letter-spacing 0.1em to 0.16em.
- Drop cap: 84px bold, line-height 0.78.

## Spacing & radius
- Page container: max-width 1080px, side padding 20px on mobile, 32px from 641px.
- Sections: 72px vertical padding; hero 72px top / 80px bottom; subscribe 88px; pull quote 96px.
- Article rows: 32px vertical padding, 24px column gap.
- Grids: 40px (mobile) and 56px (desktop) between essay columns; archive cards 28px 24px padding.
- Radius: none. Everything is square; structure comes from 1px rules and 3px double rules.
- Breakpoints (mobile first): 641px and 901px.

## Tone
Literary, austere, precise. Serif body, hairline rules, drop caps, generous margins. The red accent appears at most once per viewport (issue number, hover states, one underline).

## Do / Don't
- Do keep pure black on pure white — no grays for large surfaces.
- Do use horizontal hairline rules (1px) to structure the page, editorial multi-column text, numbered article lists with dates.
- Do keep the full-page pull quote section.
- Don't add colors beyond the single red accent, used sparingly.
- Don't use more than the 1-2 approved photos, and always in grayscale (CSS filter).

## Images
- Essay photo: https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=70 (library shelves)
- Portrait: https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=70 (open book)

Reuse these Unsplash URLs; do not hotlink other domains. Apply `filter: grayscale(1)`.
