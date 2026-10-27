# Vinyl

Mobile app starter kit (React + Vite + react-router) for music streaming: first-launch onboarding, a tab shell with a persistent mini player above a dark translucent tab bar, an album page and a full Now Playing screen. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around a spinning record and tilted sleeves, Continue / Skip, stored in `localStorage` under `vinyl_onboard_done`.
- **Home** (`/`): new album hero on a blurred cover, "Jump back in" tiles, "Made for you" covers, top 5 tracks with an equalizer on the current one, artists.
- **Search** (`/search`): search field (songs, artists, genres), recent searches, gradient genre tiles with tilted covers.
- **Library** (`/library`): Playlists / Albums / Artists switch, liked songs, album grid.
- **Profile** (`/profile`): gradient ring avatar, stats, minutes listened with top genres, crossfade and lossless toggles, sign out (back to onboarding).
- **Album** (`/album/:id`): blurred cover header, like / download / shuffle, Play all, track list. No tab bar.
- **Now Playing** (`/now-playing`): spinning vinyl with the cover as its label and a tonearm, like, scrubber, controls, lyrics peek, up next. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, player provider
  data.ts             copy, albums, tracks, playlists, artists, genres, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, mini player, tab bar), covers, track rows, buttons
  components/         AppShell, AppNavbar, TabBar, Player (context), MiniPlayer, TrackRow, Cover
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Albums, tracks, playlists, artists and lyrics: `src/data.ts`.
- Playback state (current track, queue, play/pause, progress, likes) lives in `components/Player.tsx` (`usePlayer()`). The clock is simulated; plug a real `<audio>` element in there.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
