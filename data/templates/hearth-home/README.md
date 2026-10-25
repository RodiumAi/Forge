# Hearth

Mobile app starter kit (React + Vite + react-router) for a smart home: first-launch onboarding, a tab shell with a docked glass tab bar, a room detail and a thermostat as stack screens. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): full-bleed room photo, floating glass device tiles, three slides, stored in `localStorage` under `hearth_onboard_done`.
- **Home** (`/`): blurred living room photo behind the header, glass thermostat card, status tiles, scenes, favourite devices that toggle with an amber glow.
- **Rooms** (`/rooms`): photo cards per room with device counts and temperature.
- **Energy** (`/energy`): period switch, weekly bars split solar / grid (tap a day), split detail, savings, top consumers.
- **Settings** (`/settings`): owner, home address, away / saver / alerts toggles, links, sign out (back to onboarding).
- **Room** (`/room/:id`): photo header, scene chips, lights with brightness sliders, other devices. No tab bar.
- **Climate** (`/climate`): semicircular thermostat dial, -/+ steppers, Heat / Cool / Auto, humidity, fan, schedule. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, HomeProvider
  data.ts             copy, rooms, devices, scenes, energy, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, glass tab bar), glass, device tiles, rows, buttons, slider
  components/         AppShell, AppNavbar, TabBar, HomeState (context), DeviceTile, ThermostatDial
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Home name, rooms, photos, devices and energy figures: `src/data.ts`.
- Device behaviour (toggle, dim, scenes, thermostat range): `components/HomeState.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx` (the grid has 4 columns).
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
