# Tailstore Shop

A clean fashion e-commerce storefront for a fictional label, Verano&Co. Dark charcoal header and footer, white body, amber accent and a sharp product grid rhythm.

## Sections

1. Header: logo, category links and a cart button with a count badge.
2. Hero: eyebrow, headline, lead, call to action and a large product photo.
3. Categories: three photo tiles (Men, Women, Accessories).
4. Popular products: a four-column grid of product cards.
5. Promo: a full-width amber newsletter banner with an email form.
6. Latest arrivals: a second product grid.
7. Footer: brand blurb, shop and help links.

## File structure

```
src/
  main.tsx              React entry (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  data.ts               products, categories and image URLs
  index.css             foundation: tokens, reset, base type, page shell, header, buttons, product card, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Header.tsx  Hero.tsx  Categories.tsx  ProductGrid.tsx  ProductCard.tsx  Promo.tsx  Footer.tsx
```

## Adapting it

- Change the palette in the `:root` tokens of `src/index.css`.
- Edit products and categories in `src/data.ts`; each product keeps a gradient (`g`) shown while its photo loads.
- `ProductGrid` takes a title and a product list, so adding another shelf is one line in `App.tsx`.
- Icons come from `lucide-react` (cart bag, tile arrows).
- Styles are mobile-first: base rules are the phone layout and `@media (min-width: 761px)` adds the desktop layout.
