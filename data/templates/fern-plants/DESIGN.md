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

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Hero count: 2.4rem, weight 800, letter-spacing -.03em, tabular numbers; stat numbers 1.5rem / 800.
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Navbar title: 1.02rem / 700; section and card titles .95rem to .98rem.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta; tip text .82rem.
- Buttons, chips and labels: .72rem to .8rem, weight 600 to 700; kicker uppercase with .08em tracking.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem 6.2rem (room for the tab bar), 1rem gap between blocks.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding and tab bar padding.
- Radius: 1.6rem onboarding art, 1.4rem hero, 1.15rem cards, plant cards and tip, 1.1rem stats, 1rem buttons and search, .95rem row icons, .85rem form fields, 999px pills, water buttons, chips and toggles.
- Plant cards: two-column grid, .7rem gap, min-height 8.6rem.
- Touch targets: buttons min-height 3rem, stepper buttons 2.1rem, tabs min-height 2.9rem.

## Tone
calm, nurturing, fresh.

## Do / Don't
- Do keep onboarding, top navbar, "Water today" reminders, "My plants" grid, and bottom navigation as the spine.
- Do keep leaf icons on soft botanical gradients, generous rounding, and clear watering countdowns.
- Do use `lucide-react` icons (no emoji or hand-drawn SVG icons).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Plant / guide atmosphere: https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=200&q=70 (foliage)

Prefer CSS gradients + leaf icons over photos. Reuse this Unsplash URL only; do not hotlink other domains.
