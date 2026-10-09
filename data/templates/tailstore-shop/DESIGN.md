# Template

- id: `tailstore-shop`
- name: Tailstore Shop

## Colors

- Background `--bg`: `#ffffff`
- Foreground `--fg`: `#111827` (near-black, used for dark header/footer)
- Muted `--muted`: `#6b7280`
- Accent `--accent`: `#f59e0b` (amber, CTAs and price highlights)
- Soft `--soft`: `#f3f4f6` (section backgrounds, card surfaces)

## Typography

- Font stack: `"Segoe UI", system-ui, sans-serif` everywhere (no web fonts), body line-height 1.5.
- Scale: hero h1 2.4rem (1.8rem on mobile, max 22ch), section h2 1.6rem, category tile and promo h2 at the browser default 1.5rem, card h3 1rem.
- Text: logo 1.2rem bold with 0.04em tracking, nav and buttons 0.95rem (buttons weight 600), tile links and old prices 0.9rem, card category and footnote 0.85rem.
- Eyebrow: 0.8rem, uppercase, letter-spacing 0.15em, weight 700, amber.

## Spacing & radius

- Sections use 6vw side padding: header 1rem, hero 4rem (2.5rem on mobile), category strip and promo 3rem, product grids 2rem top and 3rem bottom. Single breakpoint at 761px (mobile-first).
- Gaps: hero 3rem, header 2rem (0.8rem on mobile), grids and tiles 1.2rem, form 0.6rem.
- Padding: buttons 0.7rem 1.4rem, card body 1rem, category tile 2.5rem 1.5rem.
- Radius: buttons, inputs and cart 6px, cards and tiles 10px, hero image 12px, badge 999px.

## Tone

Clean, commercial, confident. Fashion retail vocabulary, short punchy copy,
generous whitespace, sharp product grid rhythm.

## Do

- Dark charcoal header with cart badge, white body sections.
- Product cards: square Unsplash photo (gradient container kept as network fallback), name, category, price (with strike-through old price), Add to Cart button.
- Full-width amber promo/newsletter banner between grids.
- Section order: header, hero, categories strip, product grid, promo banner, second grid, footer.

## Images

Reuse these Unsplash URLs; do not hotlink other domains.

- `https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=70` — hero visual (clothing rack); also used at w=800 for the "Capsule Wardrobe Set" card.
- `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=70` — "Heritage Chrono Watch" card (Popular); reused with `&crop=entropy` for "Heritage Chrono, Steel" (Latest).
- `https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=70` — "Court Classic Sneaker" card (Popular); reused with `&crop=entropy` for "Court Classic, Crimson" (Latest).
- `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=70` — "Organic Cotton Tee" card (Popular) and "Men" category tile.
- `https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=70` — "Waxed Field Jacket" card (Latest) and "Women" category tile.
- `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=70` — "Studio Over-Ear Headphones" card (Popular) and "Accessories" category tile.

## Don't

- No neon or playful colors outside the amber accent.
- No dense text blocks; keep copy to one line per element.
