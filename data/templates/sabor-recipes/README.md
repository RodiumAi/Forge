# Sabor (sabor-recipes)

Mobile app-shell starter kit (React + Vite) for recipes and home cooking. A warm dark phone layout with an onboarding flow, a sticky top navbar and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides over a food photo, shown on first launch only (stored in localStorage under `sabor_onboard_done`).
- **Home**: featured recipe hero, category chips and the popular recipes list.
- **Search**: search field, cuisine chips and results.
- **Saved**: two-column cookbook grid with "cook again" counters.
- **Profile**: cooking streak, shopping list, diet preferences and followed chefs.

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, category, cuisine, query) and screen composition
  data.ts             recipes, saved dishes, shopping list, chefs, photo URLs
  index.css           foundation: tokens, reset, app shell (navbar, tab bar), pills, chips, cards, recipe rows, buttons
  components/         shared parts: AppNavbar, TabBar, RecipeRow, ChipRow
  screens/            one file per screen: OnboardingScreen, HomeScreen, SearchScreen, SavedScreen, ProfileScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.home-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Content: edit `RECIPES`, `SEARCH_RESULTS`, `SAVED`, `SHOPPING`, `CHEFS` and the photo URLs in `src/data.ts` (Unsplash only, see `DESIGN.md`).
- Brand: colors in `:root` of `src/index.css`, titles in `TITLES` / `SUBS`, the name in `index.html` and `public/manifest.webmanifest`.
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
