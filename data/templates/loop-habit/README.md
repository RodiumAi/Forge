# Loop (loop-habit)

Mobile app-shell starter kit (React + Vite) for a habit tracker. A dark phone layout with an onboarding flow, a sticky top navbar and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides, shown on first launch only (stored in localStorage under `loop_onboard_done`).
- **Today**: progress ring and the daily checklist with tappable check circles and streaks.
- **Habits**: add-habit affordance and the routine list with streak pills.
- **Stats**: longest streak, completion rate and an 18-week consistency heatmap.
- **Profile**: avatar, reminders toggle, preferences and achievements.

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, habits, reminders) and screen composition
  data.ts             habits, heatmap values, achievements, preferences
  index.css           foundation: tokens, reset, app shell (navbar, tab bar), ring, cards, habit rows, buttons, toggle
  components/         shared parts: AppNavbar, TabBar, ProgressRing, HabitRow, StreakFlame
  screens/            one file per screen: OnboardingScreen, TodayScreen, HabitsScreen, StatsScreen, ProfileScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.today-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Habits: edit `INITIAL_HABITS` (name, lucide icon, schedule, streak, done) in `src/data.ts`; `HEAT` holds the heatmap intensities (0 to 4).
- Brand: colors in `:root` of `src/index.css`, the mark in `src/components/AppNavbar.tsx`, the name in `index.html` and `public/manifest.webmanifest`.
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
