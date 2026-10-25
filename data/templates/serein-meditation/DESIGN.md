# Design charter

## Template
- id: serein-meditation
- name: Serein
- kind: mobile app shell (meditation and sleep)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, classic bottom tab bar.
- Routes: `/onboarding`, `/` (Today), `/explore`, `/sleep`, `/profile`, `/session/:id` (stack screen: full-screen player, no tab bar).
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #fbf5ef (cream)
- --surface: #fffdfa, --surface-2: #f4ebe2
- --fg: #2b2420
- --muted: #8c7f76
- --accent: #e07a5f (terracotta), deeper #c9624a for small text, text on accent #fffaf5
- --sage: #a3b18a (done states, toggles), --peach: #f6c9a8
- Dusk gradient #f8d9c0 to #f2b49a to #e07a5f for the orb, stats and progress ring.
- Night block on Sleep: #332d4a to #262238 with a faint terracotta glow and tiny stars.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap");` (first line of `src/index.css`).
- Display: Fraunces (`--font-display`) at 400/500 for headings, numbers and the player timer; the italic carries one emphasized word per heading (`<em>`, terracotta).
- Body: DM Sans (`--font-sans`), 15px base, 600 for labels.
- Screen titles 2rem / 500, onboarding 2.35rem / 500, player timer 3.2rem tabular.
- Kicker: .72rem uppercase, .12em tracking, terracotta.

## Spacing & radius
- Screen padding 1.25rem, 1.6rem gap between blocks; bottom padding leaves room for the tab bar.
- Radius: 2rem hero areas, 1.6rem cards, 1.4rem tiles, 1.1rem thumbnails, 999px pills, buttons and the orb.
- Soft warm shadows (`--shadow`), never grey.
- Touch targets at least 2.75rem (44px).

## Tone
warm, unhurried, gently encouraging.

## Do / Don't
- Do keep the breathing orb as the single loud element of Today (8s cycle: 4s in, 4s out) and respect `prefers-reduced-motion`.
- Do use one italic word per heading, never a whole italic sentence.
- Do keep the tab bar classic: labels always visible, a small terracotta dot under the active tab.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the progress ring is a chart, not an icon).
- Don't use pure white backgrounds or pure black text; stay in cream and cocoa.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Calm nature for sessions (sunrise meadow, lake dock, misty tree, forest, ocean, moon) and night skies for sleep stories, all in `src/data.ts` (`images.unsplash.com`, `w=600` cards, `w=900` heroes and the player).
- Avatar: Unsplash portrait, `w=160`.

Reuse these Unsplash URLs; do not hotlink other domains.
