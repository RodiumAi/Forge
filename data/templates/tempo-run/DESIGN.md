# Design charter

## Template
- id: tempo-run
- name: Tempo Run
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0a0f0d
- --fg: #f0fdf4
- --muted: #86a08f
- --accent: #a3e635

## Tone
energetic, motivating, precise.

## Do / Don't
- Do keep onboarding, top navbar, today's activity rings + Start run CTA, and bottom navigation as the spine.
- Do keep numbers tabular (distance, pace, calories), touch targets large, and the accent reserved for progress and primary actions.
- Do draw rings, meters, bar charts and route thumbnails in pure CSS/SVG — no chart libraries.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Runner / profile avatar: https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=200&q=70 (running atmosphere)

Reuse this Unsplash URL; do not hotlink other domains. Prefer CSS gradients, rings and glyphs over photos.
