# Design charter

## Template
- id: maison-shop
- name: Maison
- kind: mobile app shell (fashion e-commerce)

## Platform
- Onboarding (first launch, `localStorage`) then the tab shell: centered serif masthead, screen, docked ecru tab bar.
- Routes: `/onboarding`, `/` (Discover), `/shop`, `/bag`, `/profile` and `/product/:id` (stack screen, no tab bar).
- Bag and wishlist are shared through `ShopProvider` (`src/components/Shop.tsx`), placed in `App.tsx`; the Bag tab shows the item count.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #f3efe8 (ecru)
- --surface: #faf8f4, --surface-2: #e8e2d8 (photo placeholders)
- --fg: #161412 (ink)
- --muted: #85807a
- --accent: #161412 (black pill buttons, active chips and sizes), --on-accent: #f3efe8
- --rust: #b4532a for prices, badges, the bag count and the delivery meter
- --line: ink at 13% for every hairline divider

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Jost:wght@400;500;600&display=swap");` (first line of `src/index.css`).
- Display: Cormorant Garamond (`--font-display`) for the masthead, titles, product names and editorial quotes; 500 to 600, italic for screen titles and the cover.
- Body: Jost (`--font-sans`), 15px base, 400 / 500.
- Labels: .68rem / 500, uppercase, .22em tracking. Buttons and tabs use the same uppercase spaced style.
- Masthead: 1.9rem / 600, .22em tracking. Cover title: 3.1rem italic. Product name: 2.3rem.

## Spacing & radius
- Screen padding 1.25rem, 2rem gap between blocks; photos bleed to the edge on the cover and the product gallery.
- Radius: 0 for photos and size boxes (editorial, square), 999px for buttons, chips, swatches and avatars.
- Touch targets at least 2.75rem (44px).

## Tone
luxurious, editorial, calm.

## Do / Don't
- Do let large model photos carry the page; text stays small, spaced and quiet.
- Do separate everything with 1px hairlines instead of cards and shadows.
- Do keep rust for money and badges only, and black for the single primary action.
- Do use `lucide-react` icons only, thin strokes (1.4 to 1.6) (no emoji, no hand-drawn icon SVG).
- Don't round the photos or add drop shadows; this is a magazine, not a dashboard.
- Don't turn this kit into a marketing landing page.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Products, the editorial cover and story, and the avatar: Unsplash photos already in `src/data.ts` (`images.unsplash.com`, `w=900` product and cover, `w=600` story, `w=160` avatar).

Reuse these Unsplash URLs; do not hotlink other domains.
