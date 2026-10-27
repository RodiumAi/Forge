# Design charter

## Template
- id: kin-care
- name: Kin
- kind: mobile app shell (health, telemedicine and appointments)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, white tab bar with labels.
- Routes: `/onboarding`, `/` (Home), `/doctors`, `/appointments`, `/profile`, `/doctor/:id` (stack screen, no tab bar).
- Appointments and favourite doctors live in `components/CareState.tsx` (React Context): a booking made on a doctor profile shows up on Home and in Appointments.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #f3f8f8 (cool mint paper)
- --surface: #ffffff, --surface-2: #eaf2f2
- --fg: #102a2b (deep teal ink)
- --muted: #6d8485
- --accent: #14907a (teal), --accent-deep: #0d6f5e, --accent-soft: #dff3ef; white text on accent
- --coral: #ff8a65 with --coral-soft: #ffe6dd for alerts, favourites, heart rate and the notification dot
- Stars: #f5a524. Specialty tints: #dff3ef, #ffe6dd, #e3ecff, #fff2d6, #ece4ff, #ffe4ee.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap");` (first line of `src/index.css`).
- Display and body: Figtree (`--font-display`, `--font-sans`), 15px base.
- Titles and numbers 800 with -.02em letter-spacing; screen titles 1.65rem, doctor name 1.6rem, onboarding title 2rem.
- Labels 700, meta .72rem to .8rem / 600; kickers uppercase .76rem / 800.

## Spacing & radius
- Screen padding 1.2rem, 1.1rem to 1.4rem gap between blocks; bottom padding clears the tab bar.
- Radius: 1.6rem hero, 1.5rem insurance card, 1.4rem cards, 1.1rem photos and search, 1rem day chips, .95rem slots, 999px chips and segmented control.
- Touch targets at least 2.75rem (44px).

## Tone
clean, reassuring, caring.

## Signature
- Home: a teal gradient hero with the next appointment (doctor portrait, date and time pills, white "Join video call" button) and a vitals row where the heart rate draws a small coral pulse line.
- Doctor cards with real portraits, a tinted specialty chip, star rating, distance, fee in FCFA and a coral favourite heart.
- Booking: seven day chips and a four column slot grid; taken slots are crossed out, the chosen day lifts in teal.
- Tab bar: white, docked, labels always visible, the active tab turns teal with a short line on top.

## Do / Don't
- Do keep teal for actions and coral for alerts, favourites and live health signals only.
- Do show prices in FCFA with French grouping.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the pulse line and bars are charts, not icons).
- Don't use pure black text; ink is #102a2b.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Doctor portraits, patient avatar and the onboarding clinic photo: Unsplash URLs in `src/data.ts` (`images.unsplash.com`, `w=600` portraits, `w=900` onboarding and doctor cover, `w=160` avatar).

Reuse these Unsplash URLs; do not hotlink other domains.
