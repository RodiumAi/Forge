# Ava

Mobile app-shell starter kit (React + Vite) for an AI assistant: first-launch onboarding, a sticky top navbar, four screens and a bottom tab bar, laid out for a phone (~390px) and kept as a centered phone column on tablet and desktop. The chat is local: what you send is appended with a canned reply, ready to wire to a real model.

## Screens

- **Onboarding**: three slides over a mini chat preview, Continue / Skip (stored in `localStorage` under `ava_onboard_done`).
- **Chat**: message thread (assistant left, user right), suggestion chips and an input bar fixed above the tab bar; the navbar "+" starts a new chat.
- **Prompts**: two-column prompt library; tapping a card sends it in the chat.
- **History**: past conversations with snippet and time.
- **Account**: model and personality settings, monthly usage meter, Pro upsell.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, current tab, messages, draft) + screen composition
  data.ts             slides, tab titles, seed messages, chips, replies, prompts, history
  index.css           foundation: tokens, reset, app shell (navbar, main, tab bar), cards, list rows, pills, buttons
  components/         AppNavbar, TabBar, ListRow, SparkIcon (shared across screens)
  screens/            OnboardingScreen, ChatScreen, PromptsScreen, HistoryScreen, AccountScreen
  styles/             one stylesheet per screen (onboarding.css, chat.css, ...), scoped under .<name>-screen
public/
  manifest.webmanifest
```

Icons come from `lucide-react`.

## Adapt it

- Change the palette in `:root` of `src/index.css` (keep `--bg`, `--fg`, `--muted`, `--accent` in sync with `DESIGN.md`).
- Edit the assistant name, seed messages, chips, replies, prompt cards and history in `src/data.ts`; replace `send()` in `App.tsx` with a call to your model.
- Add a screen: create `src/screens/<Name>Screen.tsx` rendering `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then add a tab in `components/TabBar.tsx` and a branch in `App.tsx`.
- Write CSS mobile-first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
