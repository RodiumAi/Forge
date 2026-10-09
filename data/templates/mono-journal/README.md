# mono-journal

Radically minimal typographic magazine: pure black on white, editorial columns, a drop cap,
a numbered article index, a full-page pull quote and one restrained red accent.
React + Vite, no UI library; icons come from `lucide-react`.

## Sections

1. Masthead: date, wordmark, issue number and the section nav
2. Hero: kicker, title and two-column introduction
3. ArticleIndex: numbered list of the issue's articles
4. Essay: lead essay excerpt with photo and drop cap
5. Quote: full-bleed black pull quote
6. Archive: past issues grid and a letterpress photo
7. Letters: selected letters to the editor
8. Subscribe: monthly email signup with a thank-you state
9. Footer: wordmark, links and colophon line

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, typography, .page container,
                      masthead, shared section rule, footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Masthead, Hero, ArticleIndex, Essay,
                      Quote, Archive, Letters, Subscribe, Footer)
```

The CSS is mobile first: base rules are the phone layout, `@media (min-width: 641px)` restores
the three-part masthead, two text columns and the article arrows, and `@media (min-width: 901px)`
the side-by-side essay and the four-column archive.

## Adapting it

- Publication name: the wordmark in `Masthead.tsx` and `Footer.tsx`, plus the issue number.
- Articles: the `ARTICLES` array in `ArticleIndex.tsx`; past issues: `ARCHIVE` in `Archive.tsx`.
- Essay excerpt, quote and letters are plain JSX in their components.
- Colors and the serif/sans stacks live in `:root` in `index.css`.
- Run with `npm install`, `npm run dev` (http://localhost:5173) and `npm run build`.
