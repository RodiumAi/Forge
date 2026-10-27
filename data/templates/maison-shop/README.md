# Maison

Mobile app starter kit (React + Vite + react-router) for luxury fashion shopping: first-launch onboarding, a tab shell with a serif masthead and a minimal ecru tab bar, a product page and a bag with checkout. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three full-bleed editorial photos that crossfade, Next / Skip, stored in `localStorage` under `maison_onboard_done`.
- **Discover** (`/`): magazine cover for the current edit, New in rail, editorial story with two offset frames and shop-the-look rows, ateliers note.
- **Shop** (`/shop`): category chips, sort bar, two-column staggered grid with hearts and rust prices.
- **Bag** (`/bag`): free delivery meter, items with colour, size and quantity stepper, subtotal, delivery and total in euros, Checkout then a thank-you state. The tab shows the item count.
- **Profile** (`/profile`): portrait, Maison Circle points, orders / wishlist / credit stats, wishlist rail, orders list, settings, sign out (back to onboarding).
- **Product** (`/product/:id`): swipe gallery with dots, back and heart, name and price, colour swatches, size selector, details accordion, Wear it with rail, sticky Add to bag with a toast. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, shop provider
  data.ts             copy, products, editorial, orders, delivery rules, tab paths
  index.css           Google Fonts, tokens, reset, shell (masthead, main, tab bar), product cards, chips, buttons, stepper, toast
  components/         AppShell, AppNavbar, TabBar, Shop (bag and wishlist context), ProductCard
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Products, the editorial story, orders and the free delivery threshold: `src/data.ts`.
- Bag and wishlist live in `components/Shop.tsx` (`useShop()`): add, quantities, remove, clear, hearts. Checkout is simulated; plug a payment provider in `BagScreen.tsx`.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
