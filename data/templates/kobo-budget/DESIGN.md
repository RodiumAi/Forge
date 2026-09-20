# Design charter

## Template
- id: kobo-budget
- name: Kobo
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0e1230
- --fg: #eef1ff
- --muted: #8b90bd
- --accent: #60a5fa

## Tone
clear, reassuring, organised.

## Do / Don't
- Do keep onboarding, top navbar, the budget-left ring, category progress bars, and bottom navigation as the spine.
- Do keep amounts tabular, progress bars honest (spent vs limit), and over-budget states clearly flagged.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Optional avatar / atmosphere: https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=200&q=70 (finance atmosphere)

The UI is built from CSS rings and bars — no photos are required. Reuse this Unsplash URL only if an avatar is needed; do not hotlink other domains.
