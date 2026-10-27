# Serein

Mobile app starter kit (React + Vite + react-router) for meditation and sleep: first-launch onboarding, a tab shell with a classic labelled tab bar, and a full-screen session player. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around the breathing orb and two floating photo cards, Continue / Skip, stored in `localStorage` under `serein_onboard_done`.
- **Today** (`/`): breathing orb (CSS animation, "Breathe in / Breathe out"), today's session card, daily ritual checklist, picks for the week, a short note.
- **Explore** (`/explore`): search, four photo categories (Sleep, Focus, Anxiety, Morning) as filters, session photo cards with a save toggle.
- **Sleep** (`/sleep`): night-tinted block with tonight's story, soundscape toggles and a fade-out timer, then the sleep stories list.
- **Profile** (`/profile`): identity, minutes / sessions / streak, mood check-in, October streak calendar, reminders, sign out (back to onboarding).
- **Session** (`/session/:id`): ambient photo, progress ring with timer, play / pause, skip 15s, completion state. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, SavedProvider
  data.ts             copy, sessions, categories, stories, soundscapes, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar), breathing orb, session cards, buttons
  components/         AppShell, AppNavbar, TabBar, BreathOrb, SessionCard, Saved (favorites context)
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Sessions, guides, stories and copy: `src/data.ts` (`findSession` resolves both sessions and stories for the player).
- Breathing rhythm: the `breathe` keyframes in `src/index.css` (8s = 4s in, 4s out).
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
