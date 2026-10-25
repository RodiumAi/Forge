# Mesa

Mobile app starter kit (React + Vite + react-router) for food delivery: first-launch onboarding, a light tab shell with a tomato pill on the active tab, restaurant menus, a cart and a live order tracker. Laid out for a phone (~390px), kept as a centered column on tablet and desktop.

## Screens

- **Onboarding** (`/onboarding`): three food photos with floating rating and arrival chips, Continue / Skip, stored in `localStorage` under `mesa_onboard_done`.
- **Home** (`/`): delivery address, search entry, live order strip, promo banner, category chips with icons, popular rail, restaurant photo cards.
- **Search** (`/search`): search field, recent searches, cuisine photo grid; typing lists matching dishes and restaurants.
- **Orders** (`/orders`): the active order with a four-step delivery tracker (confirmed, cooking, on the way, delivered), the courier, then past orders to reorder.
- **Profile** (`/profile`): member card with totals, invite, favourites, addresses, payment methods, notification toggles, sign out (back to onboarding).
- **Restaurant** (`/restaurant/:id`): hero photo, rating, time and fee, menu section chips, dishes with photos and quantity steppers, docked "View cart" bar. No tab bar.
- **Cart** (`/cart`): items with quantities, address, tip selector, payment, totals in FCFA, Place order, then a confirmation with the arrival time. No tab bar.

## File structure

```
src/
  main.tsx            entry (createRoot + BrowserRouter)
  App.tsx             routes, onboarding flag, CartProvider
  data.ts             copy, restaurants and menus, categories, cuisines, past orders, courier, money format, tab paths
  index.css           Google Fonts, tokens, reset, shell (navbar, main, tab bar), chips, restaurant cards, stepper, cart bar, buttons
  components/         AppShell, AppNavbar, TabBar, Cart (cart and order context), CartBar, RestaurantCard, Stepper
  screens/            one file per screen
  styles/             one stylesheet per screen, scoped under .<name>-screen
public/
  icon.svg, manifest.webmanifest
```

## Adapt it

- Palette and fonts: `:root` of `src/index.css`, kept in sync with `DESIGN.md`.
- Restaurants, dishes, prices, fees, tips and copy: `src/data.ts`. Change `CURRENCY` and `fcfa` for another currency.
- The cart holds one restaurant at a time; adding a dish from another restaurant starts a new cart (`components/Cart.tsx`). A placed order moves one tracker step every 12 seconds in the demo.
- New tab: add the screen file and its stylesheet, a route in `App.tsx`, an entry in `PATHS` and `TITLES` and one in `components/TabBar.tsx`.
- CSS is mobile first: phone rules by default, larger screens in `@media (min-width: ...)`.

Run with `npm install` then `npm run dev`.
