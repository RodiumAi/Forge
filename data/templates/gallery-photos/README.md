# Photo Gallery (Aperture Field)

Airy, warm photography portfolio (React + Vite). A dense masonry wall of Unsplash photos with category filters, on a warm paper background.

## Sections

Topbar (brand + category links), Intro (kicker, title, one-line lede), Filters (category chips), Gallery (masonry grid of captioned tiles), CTA band, Footer. The topbar links and the chips share one `active` category held in `App.tsx`.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               holds the active category and composes the sections inside
                        <div className="home-screen">
  data.ts               CATEGORIES and SHOTS (title, category, tall flag, gradient fallback, photo)
  index.css             foundation: tokens, reset, base type, .container, topbar, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Topbar.tsx  Intro.tsx  Filters.tsx  Gallery.tsx  Cta.tsx  Footer.tsx
```

CSS is mobile first: base rules are the phone layout (2-column grid), the desktop layout lives in `@media (min-width: 761px)` (3 columns).

## Adapting it

- Photos and captions: edit `SHOTS` in `src/data.ts`. Set `tall: true` for portrait tiles (3 rows instead of 2).
- Categories: edit `CATEGORIES` in `src/data.ts`; every shot category should match one of them.
- Copy: `components/Intro.tsx`, `components/Cta.tsx`, `components/Footer.tsx`.
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`).

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
