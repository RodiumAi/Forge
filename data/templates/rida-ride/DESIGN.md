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

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Stat amount: 2.4rem, weight 800, letter-spacing -.03em, tabular numbers.
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Navbar title: 1.02rem / 700; section titles .95rem.
- Ride options: name .95rem / 700, price 1rem / 800 tabular, meta .76rem.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta.
- Labels, tags and status chips: .66rem to .76rem, weight 600 to 700; sheet label uppercase with .04em tracking.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem 6.2rem (room for the tab bar), 1rem gap between blocks.
- Home map is full-bleed (negative margin), 42vh tall (min 260px); the ride sheet overlaps it by 1.25rem.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding and tab bar padding.
- Radius: 1.6rem onboarding art, 1.4rem stat hero and sheet top, 1.15rem cards, 1rem fields, ride options and buttons, .8rem to .85rem icon tiles, 999px pills, tags and status chips.
- Touch targets: buttons min-height 3rem, tabs min-height 2.9rem, navbar action 2.5rem.

## Tone
fast, confident, urban.

## Do / Don't
- Do keep onboarding, top navbar, the map + "Where to?" field + ride-options sheet, and bottom navigation as the spine.
- Do draw the map purely in CSS (grid streets, curved route, origin dot, destination pin); keep prices/ETA upfront and touch targets large.
- Do use `lucide-react` icons (no emoji, dingbats or hand-drawn SVG icons).
- Don't use any map tile service or third-party map SDK: the map is CSS only.
- Don't turn this kit into a multi-section marketing landing page, and don't add a service worker.

## Images
- Driver / avatar: https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=70 (urban portrait)

Reuse these Unsplash URLs; do not hotlink other domains.
