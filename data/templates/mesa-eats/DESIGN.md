# Design charter

## Template
- id: mesa-eats
- name: Mesa
- kind: mobile app shell (food delivery)

## Platform
- Onboarding (first launch, `localStorage` key `mesa_onboard_done`) then the tab shell: top navbar, screen, bottom tab bar.
- Routes: `/onboarding`, `/` (Home), `/search`, `/orders`, `/profile`, `/restaurant/:id` and `/cart` (stack screens, no tab bar).
- A "View cart" bar floats above the tab bar on Home and Search, and docks at the bottom of a restaurant, whenever the cart is not empty.
- Phone first (~390px); on tablet the app stays a centered 460px column.

## Colors
- --bg: #fff8f1 (warm cream)
- --surface: #ffffff, --surface-2: #f6ece2
- --fg: #1f1a17
- --muted: #8a7f77
- --accent: #e8442e (tomato), deeper #c9341f for small text, text on accent #ffffff
- --saffron: #ffc94d (ratings, promo, badges, the cart count)
- --basil: #2f6f4f (live order, free delivery, success, toggles)

## Typography
- Google Fonts: `@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap");` (first line of `src/index.css`).
- Display: Bricolage Grotesque (`--font-display`) 700/800 for headings, restaurant names, prices and ETAs, tight tracking (-.02em to -.035em).
- Body: Inter (`--font-sans`), 15px base, 600 for labels.
- Home greeting and onboarding 2.15rem / 800, screen titles 2rem / 800, restaurant name 1.95rem / 800.
- Prices: number in the display font, `FCFA` small in Inter and muted.

## Spacing & radius
- Screen padding 1.15rem, 1.5rem gap between blocks; bottom padding leaves room for the tab bar and the cart bar.
- Radius: 2.4rem onboarding photo, 1.5rem cards and photos, 1.3rem rows and tiles, 1rem thumbnails, 999px chips, pills, steppers and buttons.
- Warm brown shadows (`--shadow`, `--shadow-soft`), never grey.
- Touch targets at least 2.75rem (44px).

## Tone
appetizing, friendly, quick.

## Do / Don't
- Do let the food photos carry the screens: big rounded photo cards, a photo per dish.
- Do keep the tab bar white with a soft top shadow; only the active tab gets the filled tomato pill behind its icon, labels stay below.
- Do show money in FCFA with a space every three digits (`12 500 FCFA`), computed in `src/data.ts` (`fcfa`).
- Do use `lucide-react` icons only (no emoji, no hand-drawn icon SVG); category chips pair an icon with the cuisine name.
- Don't put more than one tomato call to action on a screen besides the cart bar.
- Don't add a service worker (`public/manifest.webmanifest` only).

## Images
- Food and restaurant photos in `src/data.ts` (`images.unsplash.com`, `w=600` cards and dishes, `w=400` cuisine tiles, `w=900` heroes and onboarding).
- Avatars (the member and the courier): Unsplash portraits, `w=160`.

Reuse these Unsplash URLs; do not hotlink other domains.
