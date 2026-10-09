# Glacier Expeditions (glacier-travel)

An immersive expedition travel site on a deep navy base with a single glacier
blue accent. React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Nav: fixed bar with the peak mark, anchor links (only "Book a journey" on small screens).
2. Hero: full-screen mountain photo under a gradient veil, title, intro, two CTAs, scroll cue.
3. Destinations: four cards with grade badge, duration and price, hover zoom.
4. Stats: four key numbers in a ruled band.
5. Itinerary: dotted vertical timeline, one step per day range.
6. Guides: photo band with a quote, then three guide cards.
7. Booking: email form with a success state (`useState`).
8. Footer: brand, journeys, company and contact columns.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             destinations, itinerary, stats and guides
  components/         one file per section (Nav, Hero, Destinations, Stats, Itinerary, Guides, Booking, Footer)
  index.css           foundation: tokens, reset, base type, buttons, nav, section heads, footer
  styles/home.css     section styles and keyframes, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, wider layouts live in
`@media (min-width: 561px)`, `861px` and `1081px` blocks.

## Adapting it

- Swap trips, itinerary days, numbers and guides in `src/data.ts`.
- Change the brand name in `Nav.tsx` and `Footer.tsx`, the headline in `Hero.tsx`.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
