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

Supporting tokens: --on-accent #061229, --danger #fb7185 (over budget, expenses), --surface / --surface-2 (fg mixed 6% / 9% into bg), --line and --track (fg at 12%). Category hues: #38bdf8, #a78bfa, #f472b6, #34d399.

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Navbar title: 1.05rem, weight 800, letter-spacing -.02em; subtitle .72rem muted.
- Onboarding headline: 1.85rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 700, uppercase, letter-spacing .08em.
- Ring amount: 2.5rem, weight 800; keypad amount: 3.1rem, weight 800; both letter-spacing -.03em.
- Section titles .95rem; card titles .98rem; row titles .9rem to .92rem, weight 650; meta .72rem to .78rem muted.
- Every amount uses tabular numbers.

## Spacing & radius
- App shell max-width 460px, centered; screen padding 1.05rem 1.1rem, bottom 6.4rem to clear the fixed tab bar.
- Screens are a grid with a 1rem gap; cards pad 1rem 1.05rem; list rows .7rem vertical.
- Tap targets: 2.5rem icon buttons, 3rem primary buttons, 3.4rem keypad keys.
- Radius: cards 1.15rem, hero 1.5rem, onboarding art 1.6rem, buttons and inputs 1rem, icon tiles .8rem to .85rem, bars and chips 999px.

## Tone
clear, reassuring, organised.

## Do / Don't
- Do keep onboarding, top navbar, the budget-left ring, category progress bars, and bottom navigation as the spine.
- Do keep amounts tabular, progress bars honest (spent vs limit), and over-budget states clearly flagged.
- Do use lucide-react icons for categories, settings and navigation (stroke 1.8).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Optional avatar / atmosphere: https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=200&q=70 (finance atmosphere)

The UI is built from CSS rings and bars, so no photos are required. Reuse this Unsplash URL only if an avatar is needed; do not hotlink other domains.
