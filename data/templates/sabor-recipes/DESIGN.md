# Design charter

## Template
- id: sabor-recipes
- name: Sabor
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #1a120b
- --fg: #fdf3e7
- --muted: #b39b82
- --accent: #f59e0b

Supporting tokens: --on-accent #241505, --surface / --surface-2 (fg mixed 6% / 10% into bg), --line (fg at 12%). Image fallbacks are warm gradients from the accent to #3a1d05 and #2a1608.

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Navbar title: 1.05rem, weight 800; subtitle .72rem muted.
- Onboarding headline: 1.85rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 800, uppercase, letter-spacing .08em.
- Hero dish name 1.45rem, line-height 1.1; eyebrow .68rem, weight 800, uppercase, letter-spacing .1em.
- Section titles 1rem; recipe names .95rem, weight 700; meta, cook time and rating .76rem.
- Streak counter 2.2rem, weight 800, tabular numbers.

## Spacing & radius
- App shell max-width 460px, centered; screen padding 1.05rem 1.1rem, bottom 6.4rem to clear the fixed tab bar.
- Screens are a grid with a 1rem gap; cards pad 1rem 1.05rem (lists .5rem 1.05rem); recipe rows .7rem vertical.
- Tap targets: 2.5rem icon buttons, 3rem primary buttons, chips .5rem .95rem.
- Radius: cards and saved tiles 1.15rem, hero 1.4rem, onboarding art 1.6rem, thumbnails, buttons and search 1rem, pills and chips 999px.

## Tone
warm, appetizing, homey.

## Do / Don't
- Do keep onboarding, top navbar, featured recipe hero, category chips, and bottom navigation as the spine.
- Do keep cook times and ratings legible, food photos warm, and touch targets large.
- Do use lucide-react icons (clock, flame, star, navigation) at stroke 1.8.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Food photography (warm, homey plates): https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=70
- Recipe thumbnails: https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=70 and https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=70

Reuse these Unsplash URLs; do not hotlink other domains. Keep alt="" and CSS gradient fallbacks behind images.
