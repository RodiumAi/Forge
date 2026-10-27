# Lumen Wallet

Mobile app starter kit (React + Vite + react-router) for a neobank: first-launch onboarding, a tab shell with a floating tab bar, and a stack screen to send money. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around a tilted lime card, Continue / Skip, stored in `localStorage` under `lumen_onboard_done`.
- **Home** (`/`): lime balance hero with sparkline and hide toggle, quick actions, "Send again" contacts, today's transactions.
- **Cards** (`/cards`): physical / virtual switch, payment card, monthly limit, freeze and online payment toggles.
- **Insights** (`/insights`): period switch, month total, daily bars, categories with progress.
- **Profile** (`/profile`): identity, plan, alerts toggle, settings links, sign out (back to onboarding).
- **Send** (`/send`): contact picker, amount keypad, success state. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag
  data.ts             copy, contacts, transactions, categories, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, floating tab bar), cards, rows, buttons
  components/         AppShell, AppNavbar, TabBar, TxRow
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Copy, currency and amounts: `src/data.ts`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
