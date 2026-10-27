# Design charter

## Template
- id: sprout-habits
- name: Sprout
- kind: mobile app shell (habits and daily planner)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, white tab bar with a raised center "+".
- Routes: `/onboarding`, `/` (Today), `/habits`, `/stats`, `/profile`, `/habit/:id` and `/new-habit` (stack screens, no tab bar).
- Habits live in `components/HabitsState.tsx` (React Context): checks, streaks, notes and new habits are shared by every screen.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #f6f7f2 (warm paper)
- --surface: #ffffff, --surface-2: #eef0e8
- --fg: #1c2420
- --muted: #7a857e
- --accent: #3a9d5d (leaf green), --accent-deep: #2b7d48 for green text on light backgrounds, white text on accent
- Pastel tiles: peach #ffe3d3, sky #dfeaff, butter #fff1c2, lilac #e8defe, mint #d9f2e1; each has a darker ink for its icon and dots (see `PALETTE` in `src/data.ts`).
- Streak flame: #f2762e on #ffe8da.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");` (first line of `src/index.css`).
- Display and body: Plus Jakarta Sans (`--font-display`, `--font-sans`), 15px base, 500 for body copy.
- Headings and numbers: 800, letter-spacing -.025em to -.04em; screen titles 1.75rem, onboarding title 2.15rem.
- Habit names 700; meta .75rem to .8rem / 600; kickers uppercase .76rem / 800, .1em tracking.

## Spacing & radius
- Screen padding 1.2rem, 1.4rem gap between blocks; bottom padding clears the tab bar and its raised button.
- Radius: 1.9rem progress hero and profile card, 1.5rem habit cards, 1.05rem icon tiles, 999px checks, chips and buttons; tab bar 1.8rem top corners.
- Touch targets at least 2.75rem (44px); the check button is 2.9rem.

## Tone
friendly, encouraging, light.

## Signature
- Today: week strip (the selected day is an ink pill), a leaf green hero with a white progress ring ("4 of 6 done", "Perfect day!" when complete) and pastel habit cards whose round check fills green with a little bounce.
- Flame streak counters everywhere (navbar pill, cards, detail).
- Stats: a Monday-first monthly heatmap from pale sage to leaf green.

## Do / Don't
- Do keep one pastel per habit and reuse its ink for icon, dots and history.
- Do keep the green hero as the only saturated block on Today.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the progress ring is a chart, not an icon).
- Don't use pure black text; ink is #1c2420.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Habit photos (detail header), the onboarding photo and avatars: Unsplash URLs in `src/data.ts` (`images.unsplash.com`, `w=600` photos, `w=900` onboarding, `w=160` avatars).

Reuse these Unsplash URLs; do not hotlink other domains.
