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

Supporting tokens: --on-accent #14210a, --surface (fg mixed 6% into bg), --line (fg at 12%), --track (fg at 10%). Gradients deepen the accent toward #4d7c0f.

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Navbar title: 1.02rem, weight 800; subtitle .72rem muted.
- Onboarding headline: 1.85rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 800, uppercase, letter-spacing .08em.
- Metrics: ring values 1.02rem (2.1rem on the onboarding ring), stat tiles 1.7rem, weekly goal 1.5rem, all weight 800 with tabular numbers.
- Row titles .92rem to .95rem, weight 700; meta .74rem to .78rem muted; chart labels .66rem.
- Start-run CTA: 1.08rem, weight 800; the GO badge weight 900, letter-spacing .06em.

## Spacing & radius
- App shell max-width 460px, centered; screen padding 1.05rem 1.1rem, bottom 6.2rem to clear the fixed tab bar.
- Screens are a grid with a 1rem gap; cards pad 1rem 1.05rem; list rows .7rem to .75rem vertical.
- Tap targets: 2.5rem icon buttons, 2.9rem play button, 3rem primary buttons.
- Radius: cards 1.15rem, tiles 1.1rem, start-run 1.25rem, rings card 1.4rem, onboarding art 1.6rem, route thumbnails .8rem to .9rem, rings, pills and meters 999px.

## Tone
energetic, motivating, precise.

## Do / Don't
- Do keep onboarding, top navbar, today's activity rings + Start run CTA, and bottom navigation as the spine.
- Do keep numbers tabular (distance, pace, calories), touch targets large, and the accent reserved for progress and primary actions.
- Do draw rings, meters, bar charts and route thumbnails in pure CSS/SVG, without chart libraries.
- Do use lucide-react for icons (stroke 1.7 to 2).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Runner / profile avatar: https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=200&q=70 (running atmosphere)

Reuse this Unsplash URL; do not hotlink other domains. Prefer CSS gradients, rings and icons over photos.
