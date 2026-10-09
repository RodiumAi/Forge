# Neon Nights (synthwave-music)

A retro synthwave artist site: violet to pink sky, striped CSS sun, perspective
floor grid, 3D vinyl album cards, tracklist and tour dates in full neon.
React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Nav: neon brand, anchor links (hidden on phones), "Listen now" button.
2. Hero: CSS sky, sun, mountains and scrolling grid floor behind the album title and CTAs.
3. Press: three pull quotes.
4. Discography: album cards with a vinyl that slides out on hover.
5. Tracklist: numbered tracks with hover play icon and equalizer bars.
6. Tour: live photo with caption and a list of dates with ticket buttons.
7. About: artist story, stats and the wall of synths.
8. Signup: newsletter form with a success state (`useState`).
9. Footer: brand, streaming links and booking contacts.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             albums, tracks, tour dates, gear and press quotes
  components/         one file per section (Nav, Hero, Press, Albums, Tracklist, Tour, About, Signup, Footer)
  index.css           foundation: tokens, reset, base type, nav, buttons, section titles, footer
  styles/home.css     section styles and keyframes, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, wider layouts live in
`@media (min-width: 641px)` and `@media (min-width: 961px)` blocks.

## Adapting it

- Rename the artist in `Nav.tsx`, `Footer.tsx` and the hero copy in `Hero.tsx`.
- Edit albums, tracks, tour dates, gear and quotes in `src/data.ts`.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
