# Design charter

## Template
- id: nova-bank
- name: Nova Bank
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0b1220
- --fg: #eaf1ff
- --muted: #8a97b5
- --accent: #34d399

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Balance amount: 2.4rem, weight 800, letter-spacing -.03em, tabular numbers.
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Navbar title: 1.02rem / 700; section titles .95rem to .98rem.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta.
- Labels, pills and tab labels: .66rem to .76rem, weight 600 to 700; kicker uppercase with .08em tracking.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem 6.2rem (room for the tab bar), 1rem gap between blocks.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding and tab bar padding.
- Radius: 1.6rem onboarding art, 1.4rem balance hero, 1.25rem payment card, 1.15rem cards, 1rem buttons and quick actions, .85rem row icons, 999px pills, avatars and toggles.
- Touch targets: buttons min-height 3rem, tabs min-height 2.9rem, navbar action 2.5rem.

## Tone
trustworthy, crisp, quietly premium.

## Do / Don't
- Do keep onboarding, top navbar, balance hero, quick actions, and bottom navigation as the spine.
- Do keep amounts tabular, touch targets large, and status colors clear (in/out).
- Do use `lucide-react` icons (no emoji or hand-drawn SVG icons).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Card / merchant avatars: https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=200&q=70 (finance atmosphere)

Reuse these Unsplash URLs; do not hotlink other domains.
