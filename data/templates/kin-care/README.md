# Kin

Mobile app starter kit (React + Vite + react-router) for health and telemedicine: first-launch onboarding, a tab shell with a white tab bar (labels visible, teal line on the active tab) and a doctor profile with booking as a stack screen. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): clinic photo with floating rating, booking and heart rate chips, three slides, stored in `localStorage` under `kin_onboard_done`.
- **Home** (`/`): search shortcut, teal hero with the next appointment (doctor photo, date, time, "Join video call"), vitals row (heart rate with a pulse line, sleep bars, steps meter), specialties, top doctors.
- **Doctors** (`/doctors`): search by name, specialty or clinic, specialty chips (preselected from Home), doctor cards with rating, distance, fee and favourite.
- **Appointments** (`/appointments`): Upcoming / Past segmented control, date block cards, video or clinic, cancel, join, prescription, book again.
- **Profile** (`/profile`): patient card and facts, teal insurance card, medical info (allergies, conditions, medication), reminder toggles, links, sign out (back to onboarding).
- **Doctor** (`/doctor/:id`): portrait cover, favourite, years / patients / rating stats, about with "Read more", video or clinic, day picker (closed days disabled), time slots (taken ones crossed out), sticky fee bar with "Book appointment", then a success state. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, CareProvider
  data.ts             copy, patient, insurance, specialties, doctors, appointments, days and slots, vitals, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar), doctor cards, chips, segmented control, buttons
  components/         AppShell, AppNavbar, TabBar, CareState (context), DoctorCard, PulseLine
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Doctors, specialties, fees (FCFA), slots, appointments and vitals: `src/data.ts`.
- Booking, cancelling and favourites: `components/CareState.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
