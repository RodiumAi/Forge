# Podux Podcast

A light, violet-accented landing page for a fictional developer podcast
("Signal&Noise"). React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Header: logo, anchor nav, "Follow the show" button.
2. Hero: season chip, show title, intro, two CTAs, listener count, studio photo with a play badge.
3. Episodes: numbered rows with cover, title, duration chip and a play/pause toggle (`useState`).
4. Hosts: three cards with round photo avatars.
5. Subscribe: violet strip with an email form.
6. Footer: dark ink band with logo, links and copyright.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             episodes, hosts and the Unsplash URL helper
  components/         one file per section (Header, Hero, Episodes, Hosts, Subscribe, Footer)
  index.css           foundation: tokens, reset, base type, header, buttons, chip, footer
  styles/home.css     section styles, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, the desktop layout lives in
`@media (min-width: 761px)` blocks.

## Adapting it

- Change the show name in `Header.tsx`, `Hero.tsx` and `Footer.tsx`.
- Edit episodes and hosts in `src/data.ts`; covers without an image fall back to their gradient.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
