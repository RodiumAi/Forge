# Design charter

## Template
- id: frame-social
- name: Frame
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Feed → bottom tabs.
- Phone-first (~430px); keep app patterns on tablet. Light theme (color-scheme: light).

## Colors
- --bg: #fbfbfd
- --fg: #101114
- --muted: #6b7280
- --accent: #8b5cf6

## Tone
playful, social, clean.

## Do / Don't
- Do keep onboarding, top navbar, stories row + photo feed, and bottom navigation as the spine.
- Do keep photos edge-friendly, tap targets large, and the story rings gradient-lively.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Posts / avatars (Unsplash, use `?auto=format&fit=crop&w=...&q=70`, alt=""):
  - photo-1500648767791-00dcc994a43e
  - photo-1494790108377-be9c29b29330
  - photo-1438761681033-6461ffad8d80
  - photo-1504674900247-0877df9cc836
  - photo-1464822759023-fed622ff2c3b
  - photo-1523275335684-37898b6baf30

Reuse these Unsplash URLs; do not hotlink other domains. CSS gradient fallbacks sit behind every image.
