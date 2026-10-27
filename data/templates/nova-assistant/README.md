# Nova

Mobile app starter kit (React + Vite + react-router) for an AI assistant: first-launch onboarding, a dark tab shell with a glowing tab pill, a working chat and a full-screen voice mode. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three slides around the orb and floating chat bubbles, Continue / Skip, stored in `localStorage` under `nova_onboard_done`.
- **Home** (`/`): greeting, animated aqua orb with rings, ask field, quick prompt cards (Plan my week, Summarize a PDF, Write an email, Explain simply), recent chats.
- **Chats** (`/chats`): search, pinned conversations, recent history with persona icons, pin toggle.
- **Explore** (`/explore`): voice mode card, group chips, persona grid (Writer, Tutor, Coach, Translator and more) with Chat and Add.
- **Profile** (`/profile`): Nova Pro plan card, usage meters, memory and voice settings, sign out (back to onboarding).
- **Chat** (`/chat/:id`): real chat; your message appends, Nova shows a typing indicator then a scripted reply; suggestion chips, pin, voice shortcut. No tab bar.
- **Voice** (`/voice`): full-screen orb with pulses, live waveform, captions, mute and end buttons. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, ChatProvider
  data.ts             user, prompts, personas, threads, scripted replies, voice lines, plan, usage, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar with glow pill), orb, chips, buttons
  components/         AppShell, AppNavbar, TabBar, ChatProvider, Orb, Message, PersonaIcon
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`. Orb layers and keyframes are in the same file.
- Copy, personas, threads and replies: `src/data.ts`. `REPLIES` maps keywords to scripted answers; swap `send()` in `components/ChatProvider.tsx` for a real model call.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
