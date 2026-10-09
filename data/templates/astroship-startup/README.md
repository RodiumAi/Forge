# Astroship Startup

Clean, light landing page for a startup or SaaS product (React + Vite). White canvas, one indigo accent, generous whitespace.

## Sections

Topbar (brand, links, log in, sign up), split Hero with a dashboard visual, Logos strip, 6-feature grid, dark CTA band with a photo on top, minimal Footer.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, .container, topbar, buttons,
                        .section-head, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Topbar.tsx  Hero.tsx  Logos.tsx  Features.tsx  Cta.tsx  Footer.tsx
```

Icons come from `lucide-react`. CSS is mobile first: base rules are the phone layout, the desktop layout lives in `@media (min-width: 761px)`.

## Adapting it

- Product name: `components/Topbar.tsx` (brand) and `components/Footer.tsx`.
- Hero copy and buttons: `components/Hero.tsx`.
- Features: edit the `features` array in `components/Features.tsx` (icon, title, text).
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`).
- New section: add `components/MySection.tsx`, render it in `App.tsx`, style it in `styles/home.css` under `.home-screen`.

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
