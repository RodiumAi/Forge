# Design charter

## Template
- id: stride-fitness
- name: Stride
- kind: mobile app shell (running and training tracker)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, dark tab bar with a raised run button.
- Routes: `/onboarding`, `/` (Today), `/workouts`, `/stats`, `/profile`, `/workout/:id` (stack screen: program detail), `/run` (stack screen: live run, opened by the center button). Stack screens have no tab bar.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #0b0b0c (asphalt)
- --surface: #161618, --surface-2: #222225
- --fg: #fafafa
- --muted: #8a8a8e
- --accent: #ff5a1f (electric orange), text on accent #0b0b0c
- --volt: #ffd23f (records, plan banner, paused state)
- Rings: Move #ff5a1f, Exercise #ffd23f, Stand #3ee0cf. The teal is also the "GPS locked" and positive trend color.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap");` (first line of `src/index.css`).
- Display: Barlow Condensed (`--font-display`), uppercase for headings, 700/800, line-height .9 to .95.
- Numbers (`.num`): Barlow Condensed 700, tabular: ring values 2.25rem, stats 2rem, total distance 5.6rem, live timer 5.4rem, live distance 4.4rem.
- Body: Inter (`--font-sans`), 15px base. Kicker .7rem uppercase, .14em tracking.

## Spacing & radius
- Screen padding 1.15rem, 1.4rem gap between blocks; bottom padding leaves room for the raised button.
- Radius: 1.6rem rings card, 1.4rem workout cards and banners, 1.1rem metric tiles, 999px chips, buttons and the run button.
- Touch targets at least 2.75rem (44px); the run button is 4.1rem.

## Tone
energetic, direct, coach-like.

## Do / Don't
- Do keep the activity rings as the hero of Today and the numbers huge and condensed.
- Do keep orange for action and progress only (run button, active ring, primary buttons); yellow for records and pauses.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; rings, bars and the route line are charts).
- Don't lighten the shell: the kit is dark everywhere, photos are darkened at the bottom so titles stay readable.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Athlete and gym photos for programs and onboarding (track start, barbell, battle ropes, hill runner, overhead press, mat work, sunset runner) in `src/data.ts` (`images.unsplash.com`, `w=900` heroes and cards).
- Avatars: Unsplash portraits, `w=160`.

Reuse these Unsplash URLs; do not hotlink other domains.
