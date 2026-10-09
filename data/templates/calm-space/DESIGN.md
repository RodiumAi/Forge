# Design charter

## Template
- id: calm-space
- name: Calm Space
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0f1220
- --fg: #eef0ff
- --muted: #9aa0c4
- --accent: #a78bfa

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Hero titles: 1.5rem, weight 800, line-height 1.1; stat numbers 1.6rem / 800, tabular.
- Navbar title: 1.02rem / 700; section titles .95rem.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta.
- Labels: .72rem to .76rem uppercase with .06em to .08em tracking; "Breathe" label .9rem with .16em tracking.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem 6.2rem (room for the tab bar), 1rem gap between blocks.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding and tab bar padding.
- Radius: 1.6rem onboarding art, 1.4rem heroes, 1.15rem cards, 1rem buttons, .85rem row icons, 999px chips, pills, play buttons and toggles.
- Breathing circle: 11rem ring, 6.5rem core, 8s ease-in-out loop.
- Touch targets: buttons min-height 3rem, play button 3.4rem, tabs min-height 2.9rem.

## Tone
soothing, gentle, unhurried.

## Do / Don't
- Do keep onboarding, top navbar, the daily-calm hero, the breathing circle, and bottom navigation as the spine.
- Do keep durations visible, touch targets large, motion slow and looping, and contrast soft.
- Do use `lucide-react` icons (no emoji, dingbats or hand-drawn SVG icons).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker, harsh colors, or fast/jarring animation.

## Images
- Session / ambience art: https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=200&q=70 (calm nightscape)

Reuse these Unsplash URLs; do not hotlink other domains.
