# Nova Bank

Mobile app-shell starter kit (React + Vite) for a neobank: first-launch onboarding, a sticky top navbar, four screens and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop.

## Screens

- **Onboarding**: three slides with a balance preview, Continue / Skip (stored in `localStorage` under `nova_onboard_done`).
- **Home**: balance hero, quick actions (Send, Add, Pay, Split), recent activity.
- **Cards**: payment card, freeze toggle, card settings.
- **Activity**: weekly spending bars and the full transaction list.
- **Account**: membership, linked accounts, security, help.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, frozen card) + screen composition
  data.ts             slides, tab titles, transactions, spending data
  index.css           foundation: tokens, reset, app shell (navbar, main, tab bar), cards, list rows, buttons
  components/         AppNavbar, TabBar, ListRow, TxRow (shared across screens)
  screens/            OnboardingScreen, HomeScreen, CardsScreen, ActivityScreen, AccountScreen
  styles/             one stylesheet per screen (onboarding.css, home.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit copy and amounts in `src/data.ts` (currency, balance, transactions) and in the screen files.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
