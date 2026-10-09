# Design charter

## Template
- id: frame-social
- name: Frame
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Feed → bottom tabs.
- Phone-first (~430px); keep app patterns on tablet. Light theme (color-scheme: light).

## Colors
- --bg: #fbfbfd
- --fg: #101114
- --muted: #6b7280
- --accent: #8b5cf6

Supporting tokens: --surface #ffffff, --like #ef4444, --line (fg at 10%), --ring (pink → violet → blue gradient used for story rings and the wordmark).

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Wordmark: 1.42rem, weight 800, letter-spacing -.03em, filled with the --ring gradient.
- Screen title (navbar h1): 1.05rem, weight 700.
- Onboarding headline: 1.9rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 700, uppercase, letter-spacing .08em.
- Body / muted copy: .9rem, line-height 1.5; captions .88rem, line-height 1.4.
- Meta (usernames, times, story names): .7rem to .86rem; tab labels .66rem, weight 600.
- Counters (likes, profile stats) use tabular numbers.

## Spacing & radius
- App shell max-width 460px, centered; screen gutter 1.1rem; onboarding padding 1.6rem / 1.4rem plus safe areas.
- Tab screens are a grid with a 1.15rem gap; posts are 1.4rem apart; bottom padding 6.2rem clears the fixed tab bar.
- Tap targets: 2.4rem icon buttons, 3rem primary buttons, 2.9rem tabs.
- Radius: buttons and cards 1rem, outline buttons .8rem, search and fields .9rem, photo drop 1.2rem, onboarding art 1.6rem, avatars and pills 999px.
- Photo grids use a 3px gap.

## Tone
playful, social, clean.

## Do / Don't
- Do keep onboarding, top navbar, stories row + photo feed, and bottom navigation as the spine.
- Do keep photos edge-friendly, tap targets large, and the story rings gradient-lively.
- Do use lucide-react icons (stroke 1.8, size 22 in the tab bar and post actions).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Posts / avatars (Unsplash, use `?auto=format&fit=crop&w=...&q=70`, alt=""):
  - photo-1500648767791-00dcc994a43e
  - photo-1494790108377-be9c29b29330
  - photo-1438761681033-6461ffad8d80
  - photo-1504674900247-0877df9cc836
  - photo-1464822759023-fed622ff2c3b
  - photo-1523275335684-37898b6baf30

Reuse these Unsplash URLs; do not hotlink other domains. CSS gradient fallbacks sit behind every image.
