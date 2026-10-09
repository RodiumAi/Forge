# Design charter

## Template
- id: trove-market
- name: Trove Market
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Home → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #faf7f2
- --fg: #1c1917
- --muted: #78716c
- --accent: #f97316

Supporting tokens: --on-accent #ffffff, --surface #ffffff, --line (fg at 10%). Pills use #c2410c text on a 15% accent tint; the promo runs #fb923c → #ea580c with a #fdba74 glow.

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Navbar title: 1.02rem, weight 800; subtitle .72rem muted.
- Onboarding headline: 1.85rem, line-height 1.12, letter-spacing -.02em; kicker .76rem, weight 800, uppercase, letter-spacing .08em.
- Promo headline 1.5rem, weight 800, line-height 1.1; promo tag .72rem uppercase, letter-spacing .1em.
- Product names .9rem, weight 700; list titles .92rem; meta .72rem to .78rem muted.
- Prices .98rem, weight 800, tabular numbers; cart total 1.05rem.

## Spacing & radius
- App shell max-width 460px, centered; screen padding 1.05rem 1.1rem, bottom 6.2rem to clear the fixed tab bar.
- Screens are a grid with a 1rem gap; product grid gap .85rem; cards pad 1rem 1.05rem; list lines .7rem vertical.
- Tap targets: 2.5rem icon buttons, 2rem add buttons, 1.85rem stepper buttons, 3rem primary buttons.
- Radius: cards 1.15rem, product tiles 1.2rem, promo 1.35rem, onboarding art 1.6rem, thumbnails .85rem, buttons 1rem, search bar, chips, pills and badges 999px.

## Tone
warm, curated, tactile.

## Do / Don't
- Do keep onboarding, top navbar, search + category chips, promo hero, product grid, and bottom navigation as the spine.
- Do keep the light surfaces warm, prices tabular, touch targets large, and the cart badge in sync with the tab.
- Do use lucide-react icons (stroke 1.8 to 2.1).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Product / hero photos: https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=70 (also photo-1542291026-7eec264c27ff, photo-1521572163474-6864f9cf17ab, photo-1434389677669-e08b4cac3105, all curated goods). Always pair with a CSS gradient fallback and alt="".
- Profile avatar: https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
