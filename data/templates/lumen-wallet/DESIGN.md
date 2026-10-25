# Design charter

## Template
- id: lumen-wallet
- name: Lumen Wallet
- kind: mobile app shell (neobank)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, floating tab bar.
- Routes: `/onboarding`, `/` (Home), `/cards`, `/insights`, `/profile`, `/send` (stack screen, no tab bar).
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #0e0f13 (ink)
- --surface: #17191f, --surface-2: #20232b
- --fg: #f4f5f7
- --muted: #8b8f9a
- --accent: #c6f432 (lime), text on accent #0e0f13
- Category tints for charts only: #7dd3fc, #fda4af, #fcd34d, #c4b5fd.

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap");` (first line of `src/index.css`).
- Display: Space Grotesk (`--font-display`) for headings, amounts and the keypad, letter-spacing -.02em to -.04em.
- Body: Inter (`--font-sans`), 15px base.
- Balance and big amounts: 2.5rem to 3.2rem / 700, tabular numbers.
- Onboarding title: 2.15rem / 700, line-height 1.05.
- Labels and meta: .72rem to .8rem; kicker uppercase, .1em tracking.

## Spacing & radius
- Screen padding 1.15rem, 1.35rem gap between blocks; bottom padding leaves room for the floating tab bar.
- Radius: 1.75rem balance hero, 1.6rem payment card, 1.4rem cards, 1.25rem action tiles, 999px pills, buttons and tab bar.
- Touch targets at least 2.75rem (44px).

## Tone
confident, precise, quietly bold.

## Do / Don't
- Do keep the lime balance hero as the single loud block of each screen; everything else stays ink and graphite.
- Do keep amounts tabular and in Space Grotesk.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the sparkline is a chart, not an icon).
- Don't turn this kit into a marketing landing page.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Avatars: Unsplash portraits already in `src/data.ts` (`images.unsplash.com`, `w=160`).

Reuse these Unsplash URLs; do not hotlink other domains.
