# Design charter

## Template
- id: voyage-trips
- name: Voyage
- kind: mobile app shell (travel discovery and booking)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, glass tab bar docked to the bottom edge.
- Routes: `/onboarding`, `/` (Explore), `/saved`, `/trips`, `/profile`, `/destination/:id` and `/booking/:id` (stack screens, no tab bar).
- Favorites are shared through `FavoritesProvider` (`src/components/Favorites.tsx`), placed in `App.tsx`.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #f5f7f8 (mist)
- --surface: #ffffff, --surface-2: #eaeef1
- --fg: #0e1a22
- --muted: #6b7a86
- --accent: #1f6feb (ocean blue), text on accent #ffffff
- --sun: #ffb547 (sunset) for prices, ratings and countdowns
- --love: #e8475f for saved hearts only
- Photo gradients: transparent to rgba(14, 26, 34, .78).

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap");` (first line of `src/index.css`).
- Display: Instrument Serif (`--font-display`), weight 400 only, for destination names, headings, prices and numbers; italic for the one emphasized word of a heading (in accent blue).
- Body: Manrope (`--font-sans`), 15px base, 600 to 800 for labels and buttons.
- Destination hero name: 4rem, line-height .9. Card names: 2.2rem. Greeting: 2.75rem.
- Kicker: .72rem / 700, uppercase, .14em tracking.

## Spacing & radius
- Screen padding 1.25rem, 1.6rem gap between blocks; bottom padding leaves room for the docked tab bar.
- Radius: 1.9rem destination cards, 1.75rem tab bar top and detail sheet, 1.5rem cards, 1.2rem thumbnails, 999px chips, buttons and glass buttons.
- Touch targets at least 2.75rem (44px).

## Tone
airy, editorial, quietly adventurous.

## Do / Don't
- Do let photos carry each screen: one big image moment per screen, then white cards on the mist background.
- Do keep names and prices in Instrument Serif, with a single italic word per heading.
- Do keep the tab bar icon-only, frosted, with the active icon in a blue circle.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the barcode is CSS).
- Don't use dark backgrounds or heavy borders; depth comes from soft shadows.
- Don't turn this kit into a marketing landing page.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Destinations, galleries and the avatar: Unsplash photos already in `src/data.ts` (`images.unsplash.com`, `w=900` heroes, `w=300` thumbnails, `w=160` avatar).

Reuse these Unsplash URLs; do not hotlink other domains.
