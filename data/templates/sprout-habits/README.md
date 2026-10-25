# Sprout

Mobile app starter kit (React + Vite + react-router) for habits and a daily planner: first-launch onboarding, a tab shell with a white tab bar and a raised "+" button, a habit detail and a new habit flow as stack screens. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): arched photo, pastel blobs, floating habit cards, three slides, stored in `localStorage` under `sprout_onboard_done`.
- **Today** (`/`): week strip (tap a day to see it), green progress ring hero, pastel habit cards with round checks and streaks, "Plant a new habit".
- **Habits** (`/habits`): totals, morning / afternoon / evening filter, every habit with its weekly dots.
- **Stats** (`/stats`): completion, perfect days, best streak, monthly heatmap (September / October), best streaks.
- **Profile** (`/profile`): identity and totals, badges, buddies, reminder toggles, links, sign out (back to onboarding).
- **Habit** (`/habit/:id`): photo, goal / frequency / reminder, streak, mark today, this week, 5-week history, notes. No tab bar.
- **New habit** (`/new-habit`): live preview, name with suggestions, icon grid, colour swatches, frequency, reminder time, then a success state. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, HabitsProvider
  data.ts             copy, habits, palette, icon picker, week, monthly history, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar with center button), habit cards, chips, buttons
  components/         AppShell, AppNavbar, TabBar, HabitsState (context), HabitCard, ProgressRing
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`; habit pastels in `PALETTE` (`src/data.ts`).
- Habits, goals, times, streaks and history: `src/data.ts`.
- Check and streak rules: `components/HabitsState.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx` (keep two tabs on each side of the "+").
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
