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

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Now playing title: 1.5rem, letter-spacing -.02em; navbar title 1.1rem / 800.
- Section titles: 1.02rem; genre tiles 1rem / 800 with a soft text shadow.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta.
- Small labels (tiles, mini-player, times, tabs): .66rem to .86rem, weight 600 to 650; times use tabular numbers.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem plus room for the tab bar (3.95rem) and mini-player (3.6rem); 1rem gap between blocks.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding, mini-player and tab bar.
- Radius: 1.6rem onboarding art, 1.5rem now-playing cover, 1.15rem cards, 1rem tiles, playlist cards, genres, search field and buttons, .9rem mini-player, .75rem to .8rem small covers, 999px avatars, chips and round controls.
- Touch targets: buttons min-height 3rem, play button 3.9rem, like button 2.7rem, tabs min-height 2.9rem.

## Tone
vivid, immersive, night-time.

## Do / Don't
- Do keep onboarding, top navbar, Home feed, the mini-player, and bottom navigation as the spine.
- Do render album and genre covers as CSS gradients; keep controls large and the now-playing screen calm.
- Do use `lucide-react` icons (no emoji or hand-drawn SVG icons).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Album art and genre tiles are CSS gradients: no image files needed.
- Optional artist/profile avatar: https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=70 (concert atmosphere)

Reuse this Unsplash URL if you need a photo; do not hotlink other domains.
