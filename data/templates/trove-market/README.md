# Trove Market (trove-market)

Mobile app-shell starter kit (React + Vite) for a curated shop. A warm light phone layout with an onboarding flow, a sticky top navbar with a cart badge and a bottom tab bar; it stays a centered phone column on tablet and desktop.

## Screens
- **Onboarding**: three slides over product tiles, shown on first launch only (stored in localStorage under `trove_onboard_done`).
- **Home**: search shortcut, category chips, promo hero and the product grid with quick add.
- **Search**: live search field, trending chips and popular picks.
- **Cart**: cart lines with quantity steppers, summary, sticky checkout, and an empty state.
- **Account**: profile card and account links (orders, addresses, payment, wishlist, notifications).

## File structure
```
src/
  main.tsx            entry (createRoot)
  App.tsx             app state (onboarding, active tab, chip, cart) and screen composition
  data.ts             products, chips, trending searches, account links, money()
  index.css           foundation: tokens, reset, app shell (navbar, tab bar, badge), search bar, chips, cards, list lines, buttons
  components/         shared parts: AppNavbar, TabBar, CartBadge, ProductCard, RowItem
  screens/            one file per screen: OnboardingScreen, HomeScreen, SearchScreen, CartScreen, AccountScreen
  styles/             one stylesheet per screen, every rule scoped under the screen root class (.home-screen ...)
public/manifest.webmanifest
```

## Adapt it
- Catalog: edit `PRODUCTS` (name, label, price, Unsplash image, gradient fallback), `CHIPS` and `TRENDING` in `src/data.ts`; the free-shipping threshold lives in `src/screens/CartScreen.tsx`.
- Brand: colors in `:root` of `src/index.css`, titles in `src/components/AppNavbar.tsx`, the name in `index.html` and `public/manifest.webmanifest`.
- New screen: add `src/screens/<Name>Screen.tsx` with a root `<main className="app-main <name>-screen">`, its `src/styles/<name>.css` scoped under `.<name>-screen`, then a tab in `src/components/TabBar.tsx`.
- Icons come from `lucide-react`; styles are mobile-first (add `@media (min-width: ...)` for larger screens).

Run it with `npm install` then `npm run dev`. See `DESIGN.md` for the design charter.
