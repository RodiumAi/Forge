# Slides templates: open sources and licences

Sources behind the Forge slides kits. We write our own templates in the Forge JSON format (`deck.json`, `slides/*.json`); the sources below are inspiration or MIT/CC0 bases. Nothing is copied from Canva, Slidesgo, Envato, SlideModel, Beautiful.ai or any source whose licence forbids redistribution in another product.

Licences were checked on 2026-10-24 on the source repository itself (GitHub licence file through `gh api repos/<repo>/license`, or the licence file read directly). A repository without a licence file is "all rights reserved" by default: listed only to say it is excluded.

## How we use a source

- **Inspiration** (palette, type pairing, layout idea): no attribution needed, nothing copied. Colors and layouts are not copyrightable on their own, but we still stay at the level of ideas.
- **Base** (CSS values, a named palette reused as is): only MIT, Apache 2.0, ISC, CC0 or CC BY. Record the attribution in the kit `DESIGN.md` under `## Sources` with name, URL, licence and copyright line.
- **Images**: Pixabay only (Pixabay Content License), downloaded into the kit `public/images/`, converted to WebP, author and page URL stored in the element `credit`.
- **Fonts**: only the curated Google Fonts list of `apps/api/app/services/brand_charter.py` (all SIL Open Font License 1.1).
- **Icons**: lucide (ISC), names checked against `apps/api/runtime/lucide_exports.json`.

## Presentation frameworks and themes

| Source | URL | Licence (verified) | What we can borrow |
|---|---|---|---|
| reveal.js built-in themes (black, white, league, beige, night, serif, simple, solarized, moon, dracula, sky, blood) | https://github.com/hakimel/reveal.js | MIT, Copyright (C) 2011-2026 Hakim El Hattab and contributors | Theme families as starting points: "serif" and "beige" for editorial and course decks, "night" and "black" for keynotes, "simple" for minimal light. Heading scale ratios, generous margins, one accent per theme. |
| Slidev | https://github.com/slidevjs/slidev | MIT, Copyright (c) 2020-present Anthony Fu | Layout vocabulary (cover, section, two-cols, image-left/right, quote, fact, statement, end) that maps almost one to one onto our 12 layouts; the "fact" layout inspired key figures. |
| Slidev official themes: default, seriph, apple-basic, bricks, shibainu | https://github.com/slidevjs/themes | MIT, Copyright (c) 2021 Slidev.js Team | seriph: serif display over a sans body, the pairing used by our course and portfolio kits. apple-basic: big centered titles, thin hierarchy, statement slides (minimal kits). bricks: bold blocks of color for creative and workshop decks. |
| slidev-theme-apple-basic | https://github.com/JeremyMeissner/slidev-theme-apple-basic | MIT, Copyright (c) 2021 Jeremy Meissner | Keynote-like spacing, image-full layouts with bottom captions. |
| slidev-theme-academic | https://github.com/alexanderdavide/slidev-theme-academic | MIT | Academic structure for thesis defense and conference decks: table of contents, figure slide with caption, references slide. |
| slidev-theme-frankfurt | https://github.com/MuTsunTsai/slidev-theme-frankfurt | MIT | Beamer "Frankfurt" look: section navigation header, ideal for the scientific conference template. |
| slidev-theme-the-unnamed | https://github.com/estruyf/slidev-theme-the-unnamed | MIT | Dark developer theme with neon accent, code-forward layouts (dev keynote, architecture). |
| slidev-theme-vuetiful | https://github.com/LinusBorg/slidev-theme-vuetiful | MIT | Green on dark technical talk theme, two-column code plus explanation. |
| slidev-theme-linkedin-carousel | https://github.com/Open-reSource/slidev-theme-linkedin-carousel | MIT | 1:1 carousel conventions (one idea per square, page counter, swipe hint) for the 1:1 format. |
| tahta | https://github.com/zcag/tahta | MIT | Idea of one deck restyled by switching a single theme object (type, shape, texture, palette): validates our token-only styling. |
| Marp core themes: default, gaia, uncover | https://github.com/marp-team/marp-core | MIT, Copyright (c) 2018 Marp team | gaia: colored background with lead slides (marketing, campaign). uncover: centered minimal type (minimal light). |
| marpstyle | https://github.com/cunhapaulo/marpstyle | MIT | Clean academic and corporate Marp themes: footer with page number, title bar. |
| matsubara0507/marp-themes | https://github.com/matsubara0507/marp-themes | MIT | Japanese-style minimal themes, strong grid. |
| cybertopia-marp | https://github.com/noraj/cybertopia-marp | MIT | Dark cyber palette for post-mortem and security decks. |
| marp-theme-flexoki | https://github.com/i-am-fran/marp-theme-flexoki | MIT | Warm paper-like light theme built on Flexoki. |
| Spectacle | https://github.com/FormidableLabs/spectacle | MIT, Copyright (c) 2013-2018 Formidable Labs | Default theme scale and the "FlexBox + Grid" slide composition; presenter mode ideas for the player. |
| impress.js | https://github.com/impress/impress.js | MIT | Not a theme source; zoom and spatial transitions as reference for zoom-in / zoom-out. |
| remark | https://github.com/gnab/remark | MIT | Simple typographic default theme, slide numbering in the corner. |

## Color systems (palettes reusable as tokens)

| Source | URL | Licence (verified) | What we can borrow |
|---|---|---|---|
| Radix Colors | https://github.com/radix-ui/colors | MIT, Copyright Modulz (2021-2022) and WorkOS (2022-present) | 12-step scales with documented roles (background, border, solid, text) and AA contrast: base for --bg / --surface / --border / --muted of light and dark themes. |
| Open Color | https://github.com/yeun/open-color | MIT | Balanced UI palette, good for charts (series colors). |
| Tailwind CSS default palette | https://github.com/tailwindlabs/tailwindcss | MIT | Familiar neutrals (slate, zinc, stone) and accents; the quarterly review uses values in that spirit. |
| Nord | https://github.com/nordtheme/nord | MIT, Copyright (c) 2016-present Sven Greb | Arctic blue palette for calm tech and onboarding decks. |
| Catppuccin | https://github.com/catppuccin/catppuccin | MIT, Copyright (c) 2021 Catppuccin | Four pastel flavors (latte light, mocha dark): playful education and workshop decks. |
| Rosé Pine | https://github.com/rose-pine/rose-pine-theme | MIT | Muted dusk palette for creative and personal decks. |
| Dracula | https://github.com/dracula/dracula-theme | MIT | High contrast dark with pink, purple, green accents: dev keynote. |
| Solarized | https://github.com/altercation/solarized | MIT | Light and dark variants sharing accents: one template, two modes. |
| Flexoki | https://github.com/kepano/flexoki | MIT, Copyright (c) 2023 Steph Ango | Ink and paper palette: editorial and minimal light. |
| Harmony | https://github.com/evilmartians/harmony | MIT | Perceptually uniform (OKLCH) palette: consistent chart series across themes. |

## Fonts, icons, images

| Source | URL | Licence | Use |
|---|---|---|---|
| Google Fonts (curated list in `brand_charter.py GOOGLE_FONTS`) | https://fonts.google.com | SIL Open Font License 1.1 | Display, body and mono roles of every template. Fonts are loaded by the player, never stored in a kit. |
| Lucide icons | https://github.com/lucide-icons/lucide | ISC, Copyright (c) Lucide Icons and Contributors (Feather parts MIT) | `icon` elements, kebab-case names. |
| Pixabay | https://pixabay.com/service/license-summary/ | Pixabay Content License: free commercial use, attribution not required, no standalone redistribution, no use of recognizable trademarks, care with recognizable people | All template photos. A template uses the photo inside a designed slide (creative effort applied), never as a standalone file for download. We still credit the author in every element. Avoid photos with logos or brands; prefer people seen from behind or not at all. |

## Excluded

| Source | Reason |
|---|---|
| Canva, Slidesgo, Freepik, Envato Elements, SlideModel, Beautiful.ai, Pitch templates | Licences forbid redistribution of templates in another product or require a per-user subscription. |
| slidev-theme-penguin, slidev-theme-dracula (jd-solanki), slidev-theme-unicorn, slidev-theme-light-icons, slidev-theme-purplin, slidev-theme-takahashi | No licence file in the repository: all rights reserved. Look only, copy nothing. |
| slidev-theme-meetup | CC BY-SA 4.0: share-alike would force our derived templates under the same licence. |
| rnd195/my-marp-themes | Mixed licences per file (NOASSERTION): only the files marked MIT could be used, check each one. |
| Unsplash | Not used for slides kits: their photos come from Pixabay only. |

## Image size

The Pixabay API returns 1280 px images (`largeImageURL`) without full API access, so full-bleed backgrounds are scaled up to the 1920 px canvas. Full API access (`fullHDURL`) would give larger files.
