# Design charter

## Template
- id: origami-3d
- name: Foldspace 3D

## Colors
- --bg: #f4f4f8
- --fg: #18181b
- --muted: #71717a
- --accent: #6366f1

Supporting tokens: --accent-soft #e0e1fc (badges, back plane), --card #ffffff, --line
rgba(24,24,27,0.1), alternate section band #ececf3, CTA gradient to #4338ca.

## Typography
- Font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif.
- Body: 16px, line-height 1.6.
- Hero title: clamp(36px, 5.6vw, 68px), weight 800, line-height 1.05, letter-spacing -0.03em.
- Section titles: clamp(26px, 3.6vw, 42px), weight 800. CTA title clamp(28px, 4.2vw, 48px).
- Card titles 18 to 20px weight 800; card text 14px muted; plan price 38px weight 800.
- Eyebrows and footer heads: 12px uppercase, weight 700, letter-spacing 0.12em to 0.16em.

## Spacing & radius
- Horizontal gutter: --gutter clamp(20px, 6vw, 88px). Section padding clamp(60px, 8vw, 110px).
- Grid gaps: clamp(20px, 3vw, 40px) for fold panels, clamp(28px, 4vw, 56px) for iso cards, 24px for plans.
- Radius: 10px buttons, 12px cube faces, 14 to 18px cards and FAQ items, 20px planes, 24px CTA band, 999px pills.
- Depth: perspective 900px (cube) and 1200px (fold panels); shadows tinted indigo.
- Breakpoints (mobile first): 641px and 981px.

## Tone
Playful, precise, engineered. Copy reads like an ambitious dev-tool company: confident verbs, technical honesty, a wink of fun.

## Do / Don't
- Do keep the pure-CSS 3D constructions: the spinning preserve-3d cube in the hero, the hinged fold panels (rotateY on edges), the isometric cards (rotateX(55deg) rotateZ(-45deg)).
- Do keep everything on the light #f4f4f8 base with a single indigo accent.
- Do use perspective on parent containers, transform-style: preserve-3d on stages.
- Don't add WebGL, canvas or JS-driven animation — all 3D is CSS transforms.
- Don't introduce a second accent color; depth comes from shadows, not hue.

## Images
- Workflow section: https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=70 (engineer at workstation)
- Testimonial: https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=70 (team collaborating)

Reuse these Unsplash URLs; do not hotlink other domains.
