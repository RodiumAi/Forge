# Design charter

## Template
- id: loop-habit
- name: Loop
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Today → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0d1b1e
- --fg: #eafcff
- --muted: #7fa3a8
- --accent: #2dd4bf

Supporting tokens: --on-accent #04201c, --flame #fbbf24 (streaks), --surface (fg mixed 5% into bg), --line (fg at 12%). Heatmap cells grade the accent at 25 / 50 / 75 / 100%.

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Navbar title: 1.02rem, weight 700; subtitle .72rem muted.
- Onboarding headline: 1.85rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 700, uppercase, letter-spacing .08em.
- Big numbers: Today progress 1.6rem, stat cards 1.9rem, onboarding ring 2.6rem, all weight 800 with tight letter-spacing.
- Row titles .92rem, weight 650; meta .78rem muted; ring captions .62rem uppercase.
- Counters use tabular numbers.

## Spacing & radius
- App shell max-width 460px, centered; screen padding 1.05rem 1.1rem, bottom 6.2rem to clear the fixed tab bar.
- Screens are a grid with a 1rem gap; cards pad 1rem 1.05rem; habit rows .7rem vertical with .8rem between icon and text.
- Tap targets: 2.5rem icon buttons, 2.15rem check circles, 3rem primary buttons.
- Radius: cards 1.15rem, progress card 1.4rem, onboarding art 1.6rem, buttons 1rem, icon tiles .85rem to .9rem, heatmap cells 3px, pills and rings 999px.

## Tone
focused, encouraging, tidy.

## Do / Don't
- Do keep onboarding, top navbar, the Today progress ring, streak checklist, and bottom navigation as the spine.
- Do keep check circles tappable, streaks visible (flame + count), and the heatmap built from CSS squares with graded accent opacity.
- Do use lucide-react icons for habits, achievements and navigation (stroke 1.8).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Profile avatar: https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70 (calm portrait)

Reuse these Unsplash URLs; do not hotlink other domains. The Today, Habits, and Stats screens are drawn with CSS (rings, heatmap squares), so no photos are needed.
