# Kinetic 2027 Conference (kinetic-conf)

Loud, kinetic-typography landing page for a design and engineering conference (React + Vite). White canvas, massive uppercase type, opposing marquee rows and hard color blocks.

## Sections

Topbar, Hero (tags, two opposing marquees with outline and filled words, lede, CTAs), Stats band, Program accordion (one day open at a time), Manifesto (blue block), Speakers (duotone photo grid), Venue (green block), Tickets (3 tiers), Newsletter (accent block with a working email form state), Footer.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, topbar, buttons, tags,
                        .section / .h2 / .section-sub, color .block family, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Topbar.tsx  Hero.tsx  Marquee.tsx  Stats.tsx  Program.tsx  Manifesto.tsx
    Speakers.tsx  Venue.tsx  Tickets.tsx  Newsletter.tsx  Footer.tsx
```

Icons come from `lucide-react`. CSS is mobile first: base rules are the phone layout, wider layouts live in `@media (min-width: 641px)` and `@media (min-width: 961px)`.

## Adapting it

- Event name: `components/Topbar.tsx` and `components/Footer.tsx` (KINETIC + year).
- Marquee words: `MARQUEE_TOP` and `MARQUEE_BOTTOM` in `components/Hero.tsx`.
- Data: each section keeps its own array at the top of its component (stats, schedule, speakers, tickets, venue facts).
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`).
- New section: add `components/MySection.tsx`, render it in `App.tsx`, style it in `styles/home.css` under `.home-screen`.

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
