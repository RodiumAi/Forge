# Design charter

## Template
- id: origami-3d
- name: Foldspace 3D

## Colors
- --bg: #f4f4f8
- --fg: #18181b
- --muted: #71717a
- --accent: #6366f1

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
