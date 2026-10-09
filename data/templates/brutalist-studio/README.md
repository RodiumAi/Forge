# Raw Works Studio (brutalist-studio)

Neo-brutalist creative studio landing page (React + Vite). Paper background, 3px black borders, hard offset shadows, giant uppercase display type, rotated stickers and a scrolling marquee.

## Sections

Nav (sticky), Hero with stickers, Marquee, Services (4 colored cards), Work (4 projects, staggered grid), Shout quote with award tags, Process (4 steps + client tags), FAQ accordion (one item open at a time), Contact box, Footer.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, nav, buttons, .section-title,
                        .tag, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Nav.tsx  Hero.tsx  Marquee.tsx  Services.tsx  Work.tsx  Shout.tsx
    Process.tsx  Faq.tsx  Contact.tsx  Footer.tsx
```

Icons come from `lucide-react`. CSS is mobile first: base rules are the phone layout, wider layouts live in `@media (min-width: 641px)` and `@media (min-width: 961px)`.

## Adapting it

- Studio name: `components/Nav.tsx` and `components/Footer.tsx` (the wordmark with the star).
- Data: each section keeps its own array at the top of its component (marquee words, services, projects, process steps, clients, FAQs, awards).
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`); keep the black border and shadow tokens.
- New section: add `components/MySection.tsx`, render it in `App.tsx`, style it in `styles/home.css` under `.home-screen`.

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
