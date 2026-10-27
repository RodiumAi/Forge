# Design charter

## Template
- id: hearth-home
- name: Hearth
- kind: mobile app shell (smart home)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, docked glass tab bar.
- Routes: `/onboarding`, `/` (Home), `/rooms`, `/energy`, `/settings`, `/room/:id` and `/climate` (stack screens, no tab bar).
- Device, scene and thermostat state lives in `components/HomeState.tsx` (React Context), shared by Home, Room and Climate.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #121417 (warm charcoal)
- --surface: #1b1e22, --surface-2: #24282d
- --glass: rgba(255,255,255,.07) with a 1px rgba(255,255,255,.12) border and a 22px backdrop blur
- --fg: #f2f2ef
- --muted: #8c9096
- --accent: #f5b544 (amber), text on accent #1b1407; used for "on" states and their glow
- --cool: #6ec6ff (climate cooling, grid energy)

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap");` (first line of `src/index.css`).
- Display and body: Outfit (`--font-display`, `--font-sans`), 15px base.
- Big temperatures and energy totals: Outfit 300 at 3.6rem to 4.6rem, letter-spacing -.04em, tabular numbers. The thin weight is part of the identity.
- Headings: 500 to 600; room title 2.3rem / 600.
- Labels and kickers: .72rem to .8rem, kicker uppercase with .12em tracking.

## Spacing & radius
- Screen padding 1.2rem, 1.5rem gap between blocks; bottom padding leaves room for the docked tab bar.
- Radius: 1.9rem hero glass card, 1.6rem room cards, 1.4rem device tiles, 1.5rem cards, 999px chips, buttons and steppers; tab bar 1.6rem top corners.
- Touch targets at least 2.75rem (44px).

## Tone
warm, calm, quietly luxurious.

## Signature
- Home: the living room photo, slightly blurred, sits behind the transparent navbar and fades into the page; the thermostat card, status tiles and device tiles above it are glass.
- Device tiles glow amber when on (accent icon disc, amber border, soft outer glow).
- Climate: a semicircular SVG dial (tick ring, track, gradient arc to the target, white knob) with -/+ steppers and Heat / Cool / Auto modes.

## Do / Don't
- Do keep amber for "on" and "heat" only; cool blue for cooling and grid power.
- Do keep big numbers in Outfit 300.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the dial and the bars are charts, not icons).
- Don't put glass on plain dark backgrounds where there is nothing to blur; use `--surface` cards there.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Room photos, the Home backdrop and the onboarding photo: Unsplash interiors in `src/data.ts` (`images.unsplash.com`, `w=600` cards, `w=900` heroes).
- Avatar: Unsplash portrait, `w=160`.

Reuse these Unsplash URLs; do not hotlink other domains.
