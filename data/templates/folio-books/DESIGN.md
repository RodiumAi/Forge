# Design charter

## Template
- id: folio-books
- name: Folio
- kind: mobile app shell (ebooks and audiobooks)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: top navbar, screen, paper tab bar.
- Routes: `/onboarding`, `/` (Home), `/discover`, `/library`, `/profile`, `/book/:id` and `/reader/:id` (stack screens, no tab bar).
- Shared state: `ShelfProvider` (status and progress of each book) wraps the routes in `App.tsx`.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #f7f1e6 (paper)
- --surface: #fffaf2, --surface-2: #efe6d6
- --fg: #231c16 (ink)
- --muted: #8a7d6e
- --accent: #9c3d2e (burgundy), text on accent #fbf6ec
- --gold: #c99a3b (stars, goal track, ledge, quote rule), used sparingly
- Reader themes: paper #f7f1e6 / ink #231c16, sepia #efe2c8 / #3a2c1e, night #16130f / #d9cdb8 (accent #d98b6e).

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap");` (first line of `src/index.css`).
- Display: Newsreader (`--font-display`) for headings, book titles, numbers, the quote of the day and the reader text. Weight 500 for headings, italic for authors, quotes and ranks.
- Body: Inter (`--font-sans`), 15px base, for labels, buttons and meta.
- Quote of the day: 1.75rem italic, line-height 1.18. Screen titles 2rem. Onboarding title 2.45rem / 500.
- Reader text: 16 to 26px (five steps), line-height 1.62, drop cap on the first paragraph of a chapter.
- Kickers: .7rem, uppercase, .12em tracking.

## Spacing & radius
- Screen padding 1.25rem, 1.75rem gap between blocks; bottom padding clears the tab bar.
- Radius: 1.6rem hero cards (continue reading, goal), 1.25rem cards, 1rem buttons and search, 999px chips.
- Book covers: 2:3, small spine radius (.18em) and outer radius .5em, with a spine crease, two page edges and a layered shadow.
- Touch targets at least 2.75rem (44px).

## Tone
literary, calm, warm and unhurried.

## Do / Don't
- Do keep the burgundy "Continue reading" card as the single loud block on Home; the rest stays paper and ink.
- Do always render books through `BookCover` (photo covers with the title set on them, or CSS typographic covers with a motif).
- Do use Newsreader for anything a reader would read (titles, quotes, prose) and Inter for interface labels.
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG; the goal ring is a chart).
- Don't use real-world book covers with real titles; covers are designed in the kit.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Photo covers (landscapes, `w=600`): photo-1516026672322-bc52d61a55d5, photo-1509316785289-025f5b846b35, photo-1534447677768-be436bb09401, photo-1505765050516-f72dcac9c60e, photo-1518837695005-2083093ee35b, photo-1547471080-7cc2caa01a7e.
- Reading scene (audiobook banner, `w=900`): photo-1506880018603-83d5b814b5a6.
- Avatars (`w=160`): photo-1573496359142-b8d87734a5a2, photo-1507003211169-0a1dd7228f2d, photo-1544005313-94ddf0286df2, photo-1500648767791-00dcc994a43e, photo-1438761681033-6461ffad8d80.

Reuse these Unsplash URLs; do not hotlink other domains.
