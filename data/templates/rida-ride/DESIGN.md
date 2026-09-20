# Design charter

## Template
- id: rida-ride
- name: Rida
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0a1417
- --fg: #e9fbfb
- --muted: #7fa0a3
- --accent: #22d3ee

## Tone
fast, confident, urban.

## Do / Don't
- Do keep onboarding, top navbar, the map + "Where to?" field + ride-options sheet, and bottom navigation as the spine.
- Do draw the map purely in CSS (grid streets, curved route, origin dot, destination pin); keep prices/ETA upfront and touch targets large.
- Don't use any map tile service or third-party map SDK — the map is CSS only.
- Don't turn this kit into a multi-section marketing landing page, and don't add a service worker.

## Images
- Driver / avatar: https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=70 (urban portrait)

Reuse these Unsplash URLs; do not hotlink other domains.
