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

## Tone
warm, curated, tactile.

## Do / Don't
- Do keep onboarding, top navbar, search + category chips, promo hero, product grid, and bottom navigation as the spine.
- Do keep the light surfaces warm, prices tabular, touch targets large, and the cart badge in sync with the tab.
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Product / hero photos: https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=70 (also photo-1542291026-7eec264c27ff, photo-1521572163474-6864f9cf17ab, photo-1434389677669-e08b4cac3105 — curated goods). Always pair with a CSS gradient fallback and alt="".

Reuse these Unsplash URLs; do not hotlink other domains.
