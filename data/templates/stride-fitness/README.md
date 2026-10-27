# Stride

Mobile app starter kit (React + Vite + react-router) for a running and training tracker: first-launch onboarding, a dark tab shell with a raised orange run button, a workout detail and a live run. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three full-bleed athlete photos with floating stat chips and mini rings, Continue / Skip, stored in `localStorage` under `stride_onboard_done`.
- **Today** (`/`): activity rings (Move, Exercise, Stand) with condensed numbers, the week strip, the next program, recent runs.
- **Workouts** (`/workouts`): filter chips (Run, Strength, HIIT, Mobility), current plan banner, program cards with athlete photos.
- **Stats** (`/stats`): Week / Month / Year switch, total distance, bar chart, summary tiles, personal records, club leaderboard.
- **Profile** (`/profile`): athlete, totals, badges, units switch, audio cues and auto-pause toggles, device, sign out (back to onboarding).
- **Workout** (`/workout/:id`): hero photo, facts, exercises; Start turns the list into a checklist, Finish shows a success state and feeds the rings. No tab bar.
- **Run** (`/run`): GO with a 3-2-1 countdown, big timer, distance, pace, kcal, heart rate, route line, pause / resume / finish, then a saved-run summary. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, ActivityProvider
  data.ts             copy, goals, runs, programs and exercises, periods, records, club, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar + run button), rings, workout cards, chips, rows, buttons
  components/         AppShell, AppNavbar, TabBar, Rings, WorkoutCard, Activity (rings and run log context)
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Goals, programs, records and copy: `src/data.ts`. The demo run pace is `SEC_PER_KM` in `screens/RunScreen.tsx`.
- Finishing a run or a workout updates the rings through `components/Activity.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx` (two tabs each side of the run button).
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
