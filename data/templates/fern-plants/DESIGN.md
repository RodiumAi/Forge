# Design charter

## Template
- id: fern-plants
- name: Fern
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0f1a14
- --fg: #eafaf0
- --muted: #86a894
- --accent: #4ade80

## Tone
calm, nurturing, fresh.

## Do / Don't
- Do keep onboarding, top navbar, "Water today" reminders, "My plants" grid, and bottom navigation as the spine.
- Do keep leaf glyphs on soft botanical gradients, generous rounding, and clear watering countdowns.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Plant / guide atmosphere: https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=200&q=70 (foliage)

Prefer CSS gradients + leaf glyphs over photos. Reuse this Unsplash URL only; do not hotlink other domains.
