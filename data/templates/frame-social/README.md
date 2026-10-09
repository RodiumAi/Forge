# Frame (frame-social)

Mobile app-shell starter kit (React + Vite) for a photo social network. A phone layout with an onboarding flow, a sticky top navbar and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides, shown on first launch only (stored in localStorage under `frame_onboard_done`).
- **Feed**: stories row and photo posts with like, comment, share and save actions.
- **Explore**: search field and a mosaic photo grid.
- **Create**: photo drop zone, caption field, post options and a share button.
- **Profile**: avatar, stats, bio, actions and a photo grid.

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, likes, saves, caption) and screen composition
  data.ts             copy, photos, posts and small helpers
  index.css           foundation: tokens, reset, app shell (navbar, tab bar), rings, grids, buttons
  components/         shared parts: AppNavbar, TabBar, Ring, PostCard, PhotoCell
  screens/            one file per screen: OnboardingScreen, FeedScreen, ExploreScreen, CreateScreen, ProfileScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.feed-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Brand: change the wordmark and titles in `src/data.ts` (`TITLES`), the colors in `:root` of `src/index.css`, and the name in `index.html` and `public/manifest.webmanifest`.
- Content: edit `STORIES`, `POSTS`, `EXPLORE` and `GALLERY` in `src/data.ts` (Unsplash photo IDs from `DESIGN.md`).
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
