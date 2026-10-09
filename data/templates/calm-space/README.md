# Calm Space

Mobile app-shell starter kit (React + Vite) for a meditation and sleep app: first-launch onboarding, a sticky top navbar, four screens and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop.

## Screens

- **Onboarding**: three slides over a slowly breathing orb, Continue / Skip (stored in `localStorage` under `calmspace_onboard_done`).
- **Home**: daily calm hero with play button, tap-to-toggle breathing circle, category chips, short sessions.
- **Explore**: category chips and guided sessions with teacher and duration.
- **Sleep**: sleep story hero, sounds and stories, bedtime reminder toggle.
- **Profile**: practice stats and settings rows.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, breathing, reminder) + screen composition
  data.ts             slides, tab titles, categories, sessions, sounds
  index.css           foundation: tokens, reset, app shell (navbar, main, tab bar), hero, chips, list rows, buttons
  components/         AppNavbar, TabBar, DailyHero, CategoryChips, ListRow, PlayIcon (shared across screens)
  screens/            OnboardingScreen, HomeScreen, ExploreScreen, SleepScreen, ProfileScreen
  styles/             one stylesheet per screen (onboarding.css, home.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit sessions, teachers, durations and sounds in `src/data.ts`; hero copy lives in the screen files.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`. Keep motion slow and honour `prefers-reduced-motion`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
