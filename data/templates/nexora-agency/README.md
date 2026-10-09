# Nexora Agency (Kovento)

Dark, premium landing page for a digital product agency (React + Vite). Deep navy canvas, one indigo accent, proof points and numbers in every section.

## Sections

Topbar, Hero with a stats panel, Clients strip, Services (4 cards), Why us (photo, checklist, stats row), Process (4 steps), Work (3 case studies), Testimonials (stars, quote, avatar), CTA box, Footer.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type (h2, .eyebrow, .lede), .container,
                        topbar, buttons, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Topbar.tsx  Hero.tsx  Clients.tsx  Services.tsx  Why.tsx  Process.tsx
    Work.tsx  Testimonials.tsx  Cta.tsx  Footer.tsx
```

Icons come from `lucide-react`. CSS is mobile first: base rules are the phone layout, the desktop layout lives in `@media (min-width: 761px)`.

## Adapting it

- Agency name: `components/Topbar.tsx` (brand), `components/Why.tsx` and `components/Footer.tsx`.
- Data: each section keeps its own array at the top of its component (services, steps, case studies, quotes, client names, stats).
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`).
- New section: add `components/MySection.tsx`, render it in `App.tsx`, style it in `styles/home.css` under `.home-screen`.

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
