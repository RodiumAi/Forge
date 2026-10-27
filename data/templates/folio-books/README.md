# Folio

Mobile app starter kit (React + Vite + react-router) for ebooks and audiobooks: first-launch onboarding, a tab shell with a paper tab bar, a book detail screen and a real reading view. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around a fan of book covers, Continue / Skip, stored in `localStorage` under `folio_onboard_done`.
- **Home** (`/`): burgundy "Continue reading" hero with cover, chapter and progress, quote of the day, weekly streak, nightstand shelf, friends' books.
- **Discover** (`/discover`): search, genre chips, editors' picks on a wooden ledge, audiobook of the week, top charts with a "want to read" toggle.
- **Library** (`/library`): Reading / Want to read / Finished segmented control with counts, grid of covers with progress.
- **Profile** (`/profile`): yearly goal ring, books per month, stats, reminder toggles, sign out (back to onboarding).
- **Book** (`/book/:id`): cover over a blurred backdrop, rating, facts, Read / Listen (mini audiobook player), synopsis, chapters. No tab bar.
- **Reader** (`/reader/:id`): serif page with drop cap, Aa panel (five text sizes, paper / sepia / night), quick night toggle, page turns and progress. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, ShelfProvider
  data.ts             books, reader pages, quote, genres, charts, shelf, goal, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, paper tab bar), book covers, chips, buttons
  components/         AppShell, AppNavbar, TabBar, BookCover, Stars, ShelfProvider
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`. Reader themes are at the top of `src/styles/reader.css`.
- Books, covers and copy: `src/data.ts`. A cover is either `{ kind: "photo", src, tint }` or `{ kind: "type", bg, ink, motif }`.
- Shelf logic (status, progress, want to read): `components/ShelfProvider.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
