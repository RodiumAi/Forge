# Design charter

## Template
- id: aurora-ai
- name: Aurora AI

## Colors
- --bg: #050208
- --fg: #f4f1fa
- --muted: #8b84a3
- --accent: #7c3aed

## Typography
- Font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif (system fonts, no web fonts). Quote marks use Georgia, serif.
- Body: 1rem, line-height 1.6, antialiased.
- Hero h1: clamp(2.4rem, 4.6vw, 3.9rem), weight 800, line-height 1.08, letter-spacing -0.03em.
- Section h2: clamp(1.7rem, 3.2vw, 2.5rem), letter-spacing -0.02em, line-height 1.15.
- Card h3: 1.08rem to 1.15rem. Body copy in cards: 0.85rem to 0.95rem in --muted.
- Labels and pills: 0.72rem to 0.82rem, weight 600, letter-spacing 0.04em (uppercase labels 0.1em to 0.18em).
- Big numbers (stats, prices): 2rem to 2.4rem, weight 800, gradient text.

## Spacing & radius
- Container: min(1160px, 92%), centered.
- Section padding: 56px to 72px vertical (hero 64px top on mobile, 96px on desktop; CTA 48px 0 96px).
- Grid gaps: 18px to 22px for cards, 56px between two-column blocks.
- Card padding: 26px to 34px.
- Radius: --radius 18px for glass cards, 12px for buttons, 10px for the burger, 999px for pills and the billing toggle.
- Breakpoints (mobile first): 641px (two columns, floating cards) and 961px (full desktop grid).

## Tone
Visionary, sleek, quietly confident. Short headlines, precise product copy, no hype-shouting.

## Do / Don't
- Do keep the animated aurora background (blurred conic/radial gradients drifting behind content).
- Do keep glassmorphism cards (translucent surfaces, 1px light borders, backdrop blur).
- Do keep the 3D-tilted dashboard mockup in the hero (perspective + rotateX/rotateY).
- Don't switch to a light theme; the deep black canvas is the identity.
- Don't add more than one accent family (violet with subtle cyan/pink aurora hues only).

## Images
- Dashboard mockup: https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70 (analytics dashboard)
- AI abstract: https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=70 (AI robot hand)
- Team at work: https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=70 (team collaborating)

Reuse these Unsplash URLs; do not hotlink other domains.
