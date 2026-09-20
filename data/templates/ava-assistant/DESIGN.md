# Design charter

## Template
- id: ava-assistant
- name: Ava
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Chat → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0a0a0f
- --fg: #f2f2f7
- --muted: #8b8b9a
- --accent: #8b5cf6

## Tone
smart, helpful, friendly.

## Do / Don't
- Do keep onboarding, top navbar, chat thread, and bottom navigation as the spine.
- Do keep assistant bubbles left (surface) and user bubbles right (accent), with suggestion chips and a sticky input bar that appends what you type.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Optional assistant/atmosphere avatar: https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=200&q=70 (soft AI glow)

The chat UI is icon- and gradient-driven; photos are optional. Reuse this Unsplash URL only; do not hotlink other domains.
