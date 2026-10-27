# Design charter

## Template
- id: vinyl-music
- name: Vinyl
- kind: mobile app shell (music streaming)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, mini player, docked tab bar.
- Routes: `/onboarding`, `/` (Home), `/search`, `/library`, `/profile`, `/album/:id` and `/now-playing` (stack screens, no tab bar).
- Playback is shared through `PlayerProvider` (`src/components/Player.tsx`), placed in `App.tsx`; the mini player opens `/now-playing`.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #0d0b12 (night)
- --surface: #17141f, --surface-2: #221d2c
- --fg: #f7f4fa
- --muted: #8e879a
- --accent: #ff3d7f (hot pink), --accent-2: #7b5cff (violet)
- --grad: linear-gradient(135deg, #ff3d7f, #7b5cff) for play buttons, toggles, the profile ring and highlights
- Each album has a `tint` used for glows and the lyrics card.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap");` (first line of `src/index.css`).
- Display: Syne (`--font-display`) for screen titles, album and track titles on Now Playing, lyrics, numbers; 700 to 800, letter-spacing -.02em.
- Body: Inter (`--font-sans`), 15px base; track rows .95rem / 600, meta .76rem.
- Now Playing title: 1.75rem / 800. Listening minutes: 3rem / 800.
- Kicker: .7rem / 700, uppercase, .14em tracking.

## Spacing & radius
- Screen padding 1.15rem, 1.7rem gap between blocks; bottom padding leaves room for the mini player and the tab bar.
- Radius: 1.75rem hero, 1.25rem covers, 1.15rem mini player, 1.1rem genre tiles, 999px vinyl, avatars, play buttons and chips.
- Touch targets at least 2.75rem (44px).

## Tone
vivid, nocturnal, playful.

## Do / Don't
- Do let album art lead: covers on every screen, blurred cover backgrounds for heroes and the album header.
- Do keep the pink to violet gradient for primary actions only (play, toggles, the active state).
- Do keep the vinyl a CSS object (grooves, sheen, tonearm) with the cover as its label; it spins only while playing.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG).
- Don't use light surfaces; contrast comes from the night background and white text.
- Don't turn this kit into a marketing landing page.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Covers, playlists, genre tiles, artists and the avatar: Unsplash photos already in `src/data.ts` (`images.unsplash.com`, `w=600` covers, `w=300` lists, `w=160` avatar).

Reuse these Unsplash URLs; do not hotlink other domains.
