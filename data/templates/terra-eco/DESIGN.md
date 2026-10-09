# Design charter

## Template
- id: terra-eco
- name: Terra Collective

## Colors
- --bg: #e8e4d8
- --fg: #2a3a29
- --muted: #6f7a68
- --accent: #c67b3e

Deep green surface: #3d5a3c used for dark bands and blob shapes.

Supporting tokens: --bg-alt #dcd6c4 (projects band), --green-deep #2e452d (cards on green, footer),
#f2efe5 (light cards), #e9b788 (warm figures and icons on green), #eef0e4 (text on green).

## Typography
- Display serif: Georgia, "Times New Roman", "Iowan Old Style", serif (headlines, figures, quotes).
- UI sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif (body, nav, buttons, labels).
- Body: line-height 1.6; lede 18px, section subtitles 17px, card text 15 to 16px.
- h1: clamp(38px, 5vw, 58px), weight 700, line-height 1.12, letter-spacing -0.02em.
- h2: clamp(30px, 4vw, 44px), weight 700, line-height 1.15.
- Card titles 22 to 27px serif; impact figures 46px serif.
- Eyebrow: 13px uppercase, weight 700, letter-spacing 0.14em, terracotta.

## Spacing & radius
- Containers: max-width 1180px (sections, hero, footer), 1080px (impact and project grids).
- Side padding 20px on mobile, 40px from 601px. Sections 88px vertical; hero 48px (72px desktop) top, 96px bottom.
- Grid gaps: 24 to 32px for cards, 48 to 64px for project rows.
- Radius: organic only. --blob (60% 40% 30% 70% / 60% 30% 70% 40%) for photos and shapes,
  asymmetric pebble radii on buttons and cards, 30 to 40px pills for tags and inputs.
- Breakpoints (mobile first): 601px and 961px.

## Tone
Warm, grounded, hopeful. Serif-flavored headlines, generous organic curves, no hard corners anywhere.

## Do / Don't
- Do use organic blob border-radius (60% 40% 30% 70% / 60% 30% 70% 40%) on photos and accent shapes.
- Do separate major sections with the inline SVG wave dividers.
- Do keep the earthy trio (#3d5a3c, #e8e4d8, #c67b3e) — terracotta accent only for CTAs and highlights.
- Don't use pure white or pure black.
- Don't add sharp rectangles or neon colors.

## Images
- Hero forest: https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70
- Hands & soil: https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=70
- Reforestation: https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=70
- Ocean project: https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1200&q=70
- Regenerative farm: https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
