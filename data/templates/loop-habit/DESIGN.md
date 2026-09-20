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

## Tone
focused, encouraging, tidy.

## Do / Don't
- Do keep onboarding, top navbar, the Today progress ring, streak checklist, and bottom navigation as the spine.
- Do keep check circles tappable, streaks visible (flame + count), and the heatmap built from CSS squares with graded accent opacity.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Profile avatar: https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70 (calm portrait)

Reuse these Unsplash URLs; do not hotlink other domains. The Today, Habits, and Stats screens are drawn with CSS (rings, heatmap squares) — no photos needed.
