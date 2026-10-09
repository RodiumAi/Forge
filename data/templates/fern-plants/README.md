# Fern

Mobile app-shell starter kit (React + Vite) for a plant care app with watering reminders: first-launch onboarding, a sticky top navbar, four screens and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop.

## Screens

- **Onboarding**: three slides with a watering-today preview, Continue / Skip (stored in `localStorage` under `fern_onboard_done`).
- **Home**: "Water today" hero and checklist (tap Water to mark a plant done), "My plants" grid with watering countdowns, care tip.
- **Explore**: searchable care guides with light needs and difficulty.
- **Add**: add-a-plant form (name, room, watering interval stepper, light picker) with a confirmation.
- **Profile**: care stats, reminder and notification toggles, tools list.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, watered plants, toggles, search, form) + screen composition
  data.ts             slides, tab titles, due plants, plant grid, guides, light options, empty form
  index.css           foundation: tokens, reset, app shell (navbar, main, tab bar), cards, list rows, pills, buttons, toggles
  components/         AppNavbar, TabBar, ListRow, ToggleRow (shared across screens)
  screens/            OnboardingScreen, HomeScreen, ExploreScreen, AddScreen, ProfileScreen
  styles/             one stylesheet per screen (onboarding.css, home.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit plant names, rooms, watering intervals, light needs and guides in `src/data.ts`; the care tip lives in `screens/HomeScreen.tsx`.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
