# Design charter

## Template
- id: nova-assistant
- name: Nova
- kind: mobile app shell (AI assistant, chat and voice)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, dark tab bar.
- Routes: `/onboarding`, `/` (Home), `/chats`, `/explore`, `/profile`, `/chat/:id` and `/voice` (stack screens, no tab bar).
- Shared state: `ChatProvider` (threads, pins, typing state, scripted replies) wraps the routes in `App.tsx`.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #0b0d10 (near black, slightly cool)
- --surface: #13161b, --surface-2: #1b1f26, hairlines at 8% of fg
- --fg: #eceff3
- --muted: #8a94a3
- --accent: #5eead4 (aqua), text on accent #062621, glow `0 0 22px` at 45%
- --pink: #f0abfc, used sparingly (orb highlight, one persona tone, voice backdrop)
- Danger: #ef4444 for the end call button only.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap");` (first line of `src/index.css`).
- Display: Sora (`--font-display`) for the wordmark, greetings, screen titles, plan names and voice captions. Weight 600, tight tracking (-.025em).
- Body: Inter (`--font-sans`), 15px base, for messages, labels and buttons. Messages at .94rem, line-height 1.55.
- Kickers: .7rem uppercase, .12em tracking; voice status .74rem, .14em, aqua.

## Spacing & radius
- Screen padding 1.2rem, 1.6rem gap between blocks; bottom padding clears the tab bar and the safe area.
- Radius: 1.35rem cards and prompt tiles, 1.25rem chat bubbles (tail corner .35rem), 1.6rem composer, 999px chips, pills and buttons.
- Touch targets at least 2.75rem (44px); voice controls 4.4rem.

## Tone
calm, precise and quietly futuristic.

## Do / Don't
- Do keep the orb as the one signature visual: Home stage, assistant avatar in the chat, onboarding and voice mode. It is pure CSS (radial gradients, a slow conic swirl, a breathing glow).
- Do keep aqua for what is live or active (active tab pill, send button, typing dots, listening state); pink only as a second light.
- Do render assistant replies through `Message` (bullets with "- ", actions Copy / Good answer / Regenerate).
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG).
- Don't turn the palette purple or add gradients to text blocks; the dark stays neutral.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Avatar (`w=160`): photo-1539571696357-5a69c17a67c6.
- Everything else (orb, persona tiles, waveform) is CSS. Reuse this Unsplash URL; do not hotlink other domains.
