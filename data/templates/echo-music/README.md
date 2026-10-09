# Echo

Mobile app-shell starter kit (React + Vite) for a music streaming app: first-launch onboarding, a sticky top navbar, four screens, a persistent mini-player and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop. Covers are CSS gradients, so the kit ships no image files.

## Screens

- **Onboarding**: three slides over an animated equalizer, Continue / Skip (stored in `localStorage` under `echo_onboard_done`).
- **Home**: recently played rail and "Made for you" playlists; tapping a cover starts it in the mini-player.
- **Search**: search field and a "Browse all" genre grid.
- **Library**: pinned Liked Songs, artists, albums and playlists.
- **Now playing**: large cover, like button, progress bar, shuffle / previous / play-pause / next / repeat, offline download.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, current track, playing, liked) + screen composition
  data.ts             slides, tab titles, albums, playlists, genres, library, cover() gradient helper
  index.css           foundation: tokens, reset, app shell (navbar, main, mini-player, tab bar), section heads, list rows, buttons
  components/         AppNavbar, TabBar, MiniPlayer, SectionHead, MediaIcons (shared across screens)
  screens/            OnboardingScreen, HomeScreen, SearchScreen, LibraryScreen, NowPlayingScreen
  styles/             one stylesheet per screen (onboarding.css, home.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit artists, tracks, playlists, genres and their gradient colors (`g1`, `g2`) in `src/data.ts`.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
