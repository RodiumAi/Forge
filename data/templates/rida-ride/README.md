# Rida

Mobile app-shell starter kit (React + Vite) for a ride-hailing app: first-launch onboarding, a sticky top navbar, four screens and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop. The map is drawn in CSS only (no tile service).

## Screens

- **Onboarding**: three slides over a mini map with route and nearest-driver card, Continue / Skip (stored in `localStorage` under `rida_onboard_done`).
- **Home**: full-bleed CSS map with route, car and pin, then a ride sheet: "Where to?" field, ride options (Eco, Comfort, Van) with price and ETA, Book ride.
- **Trips**: upcoming, completed and cancelled rides with fare and status.
- **Activity**: monthly spend hero, favorite places, receipts.
- **Account**: payment methods, saved places, safety, help.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, selected ride) + screen composition
  data.ts             slides, tab titles, ride tiers, trips, places, receipts
  index.css           foundation: tokens, reset, app shell (navbar, main, tab bar), CSS map layers, list rows, pills, buttons
  components/         AppNavbar, TabBar, MapLayers, ListRow, BoltIcon (shared across screens)
  screens/            OnboardingScreen, HomeScreen, TripsScreen, ActivityScreen, AccountScreen
  styles/             one stylesheet per screen (onboarding.css, home.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit city, ride tiers, prices, ETA, trips and places in `src/data.ts`; the route curve is the `path` passed to `MapLayers`.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
