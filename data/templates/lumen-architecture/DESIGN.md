# Design charter

## Template
- id: lumen-architecture
- name: Lumen Atelier

## Colors
- --bg: #faf9f6
- --fg: #1c1917
- --muted: #78716c
- --accent: #b45309

Supporting tokens: --hairline rgba(28,25,23,0.16) for every rule, #f3f1ec for service hover.

## Typography
- Serif: Georgia, "Times New Roman", Times, serif, weight 400 (headlines, numbers, names, quotes).
- Sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif (body, labels).
- Body: 16px, line-height 1.6; hero lede 17px; card text 14 to 15px in --muted.
- Hero title: clamp(38px, 7.2vw, 104px), line-height 1.04, letter-spacing -0.015em, max-width 18ch.
- Section titles: clamp(30px, 4.4vw, 56px). Contact title: clamp(36px, 6vw, 84px).
- Card titles 22 to 26px serif; pull quote clamp(22px, 2.6vw, 32px) italic.
- Labels: 11 to 13px uppercase, letter-spacing 0.06em to 0.22em.

## Spacing & radius
- Horizontal gutter: --gutter clamp(20px, 6vw, 96px). Section padding clamp(64px, 9vw, 130px).
- Grid gaps: clamp(24px, 4vw, 56px) for work and team, clamp(32px, 6vw, 88px) for philosophy, 1px hairline grid for services.
- Narrow work cards drop by clamp(24px, 6vw, 96px) on desktop for the asymmetric rhythm.
- Radius: none. No shadows, no gradients.
- Breakpoints (mobile first): 721px and 901px.

## Tone
Editorial, restrained, museum-grade. Long serif headlines, generous margins, quiet confidence. Copy reads like an architecture monograph.

## Do / Don't
- Do keep the immense Georgia serif headlines and the 01 / 02 / 03 section numbering.
- Do use hairline 1px rules to separate sections; whitespace is the primary ornament.
- Do keep the project grid asymmetric — alternating wide/narrow full-bleed photos.
- Don't add bright colors beyond the single amber accent (#b45309).
- Don't use rounded corners, drop shadows or gradients; everything stays flat and sharp.

## Images
- Hero: https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=70 (white concrete building)
- Project — Meridian House: https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70 (modern house exterior)
- Project — Kiln Pavilion: https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=70 (concrete pavilion)
- Project — Vault Gallery: https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=70 (geometric facade)
- Project — Slate Courtyard: https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=1200&q=70 (glass office building)
- Philosophy: https://images.unsplash.com/photo-1481253127861-534498168948?auto=format&fit=crop&w=1200&q=70 (minimal stairwell)
- Team portrait 1: https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70
- Team portrait 2: https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70
- Team portrait 3: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
