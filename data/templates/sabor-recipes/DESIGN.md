# Design charter

## Template
- id: sabor-recipes
- name: Sabor
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #1a120b
- --fg: #fdf3e7
- --muted: #b39b82
- --accent: #f59e0b

## Tone
warm, appetizing, homey.

## Do / Don't
- Do keep onboarding, top navbar, featured recipe hero, category chips, and bottom navigation as the spine.
- Do keep cook times and ratings legible, food photos warm, and touch targets large.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Food photography (warm, homey plates): https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=70
- Recipe thumbnails: https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=70 and https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=70

Reuse these Unsplash URLs; do not hotlink other domains. Keep alt="" and CSS gradient fallbacks behind images.
