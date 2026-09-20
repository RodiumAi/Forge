# Design charter

## Template
- id: echo-music
- name: Echo
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.
- A persistent mini-player bar sits above the tab bar on every screen.

## Colors
- --bg: #0c0a12
- --fg: #f5f0fb
- --muted: #9b90ad
- --accent: #ec4899

## Tone
vivid, immersive, night-time.

## Do / Don't
- Do keep onboarding, top navbar, Home feed, the mini-player, and bottom navigation as the spine.
- Do render album and genre covers as CSS gradients; keep controls large and the now-playing screen calm.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Album art and genre tiles are CSS gradients — no image files needed.
- Optional artist/profile avatar: https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=70 (concert atmosphere)

Reuse this Unsplash URL if you need a photo; do not hotlink other domains.
