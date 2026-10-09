# holo-portfolio

A futuristic creative portfolio (Meta Morph) for a fictional creative technologist. Near-black background, giant animated gradient titles, holographic project cards, neon tag pills and a CSS grain overlay.

## Sections

1. Nav: sticky bar with the gradient logo and links (only the "Let's talk" pill on small phones).
2. Hero: giant three-line title, intro, availability pills, stats and a bobbing scroll cue.
3. Work: a holographic project card driven by previous/next arrows and a thumbnail grid (React state).
4. Services: three cards with lucide icons.
5. About: studio photo, bio and animated skill bars.
6. Press: an infinite marquee of press mentions.
7. Process: four numbered steps.
8. Contact: oversized call to action, email link and tags.
9. Footer: logo, links and note.

## File structure

```
src/
  main.tsx              React entry (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, page shell, grain, gradient text, titles, pills and tags, nav, footer
  styles/home.css       section styles and their keyframes, every selector scoped under .home-screen
  components/
    Nav.tsx  Hero.tsx  Work.tsx  Services.tsx  About.tsx  Press.tsx  Process.tsx  Contact.tsx  Footer.tsx
```

## Adapting it

- Change the palette and the `--holo` gradient in the `:root` tokens of `src/index.css`.
- Edit content where it lives: `projects` in `Work.tsx`, `services` in `Services.tsx`, `skills` in `About.tsx`, `press` in `Press.tsx`, `process` in `Process.tsx`.
- Icons come from `lucide-react` (arrows, service icons, marquee sparkles).
- Styles are mobile-first: base rules are the phone layout, `@media (min-width: 561px)` and `@media (min-width: 961px)` add the wider layouts.
- Run it with `npm install` then `npm run dev`.
