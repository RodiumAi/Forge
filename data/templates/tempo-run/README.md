# Tempo Run (tempo-run)

Mobile app-shell starter kit (React + Vite) for a running tracker. A dark phone layout with an onboarding flow, a sticky top navbar and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides with a progress ring, shown on first launch only (stored in localStorage under `temporun_onboard_done`).
- **Home**: today's activity rings, the Start run CTA, the last run and weekly bars.
- **Runs**: recent sessions with route thumbnails, distance and pace.
- **Stats**: weekly and monthly tiles, weekly distance chart and personal bests.
- **Profile**: weekly goal meter, connected devices and settings (auto-pause toggle).

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, auto-pause) and screen composition
  data.ts             runs, weekly bars, rings, personal bests, devices
  index.css           foundation: tokens, reset, app shell (navbar, tab bar), ring, cards, route thumb, bars, rows, buttons, motion
  components/         shared parts: AppNavbar, TabBar, ActivityRing, RouteThumb, WeekBars, ListRow
  screens/            one file per screen: OnboardingScreen, HomeScreen, RunsScreen, StatsScreen, ProfileScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.home-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Data: edit `RUNS`, `WEEK`, `RINGS`, `BESTS` and `DEVICES` in `src/data.ts`; route traces live in `src/components/RouteThumb.tsx`.
- Brand: colors in `:root` of `src/index.css`, titles in `TITLES` / `SUBS`, the name in `index.html` and `public/manifest.webmanifest`.
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
