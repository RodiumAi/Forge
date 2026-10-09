# Kobo (kobo-budget)

Mobile app-shell starter kit (React + Vite) for personal budgeting. A dark phone layout with an onboarding flow, a sticky top navbar and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides, shown on first launch only (stored in localStorage under `kobo_onboard_done`).
- **Home**: budget-left ring, category limits with progress bars, recent expenses.
- **Add**: amount display, category chips, note field and a keypad to log an expense.
- **Stats**: six-month spend bars, income vs expenses, top categories.
- **Account**: profile header and settings lists.

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, amount, chip, note) and screen composition
  data.ts             budget model, categories, expenses, settings rows
  index.css           foundation: tokens, reset, app shell (navbar, tab bar), ring, cards, rows, buttons
  components/         shared parts: AppNavbar, TabBar, ProgressRing, CategoryRow, ListRow
  screens/            one file per screen: OnboardingScreen, HomeScreen, AddScreen, StatsScreen, AccountScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.home-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Money: change `BUDGET`, `SPENT`, `CATS` (name, icon, spent, limit, hue) and `RECENT` in `src/data.ts`; the currency label lives in the Home and Add screens.
- Brand: colors in `:root` of `src/index.css`, the "k" mark in `src/components/AppNavbar.tsx`, the name in `index.html` and `public/manifest.webmanifest`.
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
