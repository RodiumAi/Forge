# Voyage

Mobile app starter kit (React + Vite + react-router) for travel discovery and booking: first-launch onboarding, a tab shell with a frosted glass tab bar, a destination detail and a booking flow. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around a fan of destination cards, Continue / Skip, stored in `localStorage` under `voyage_onboard_done`.
- **Explore** (`/`): serif greeting, search, category chips, "Trending" carousel of tall photo cards with hearts, a last-minute deal, weekend escapes.
- **Saved** (`/saved`): favorites grid read from the favorites context, empty state.
- **Trips** (`/trips`): upcoming / past switch, trip hero with countdown, boarding pass, itinerary timeline.
- **Profile** (`/profile`): identity, travel stats, Voyage Plus progress, price alerts toggle, settings, sign out (back to onboarding).
- **Destination** (`/destination/:id`): full-bleed hero with back and heart over the photo, story, highlights, gallery, price per night and Book. No tab bar.
- **Booking** (`/booking/:id`): date chips, nights, guests steppers, totals, Confirm, success state. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, favorites provider
  data.ts             copy, destinations, trip, dates, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, glass tab bar), destination cards, chips, rows, buttons
  components/         AppShell, AppNavbar, TabBar, Favorites (context), DestinationCard, HeartButton
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Destinations, prices (EUR per night), the upcoming trip and its itinerary: `src/data.ts`.
- Saved places live in `components/Favorites.tsx` (`useFavorites()`); seed the starting list there.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
