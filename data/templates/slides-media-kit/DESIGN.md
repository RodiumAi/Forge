# Design charter: Kit média

## Template
- id: slides-media-kit
- name: Media kit (Kit média)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FDF8F4 (slide background)
- `--surface`: #F6E9DF (cards, panels and quote slides)
- `--fg`: #26201C (main text)
- `--muted`: #7B6D63 (secondary text, captions)
- `--accent`: #C2477A (brand accent: bars, numbers, icons)
- `--accent-2`: #E9A23B (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #EBD9CC (hairlines, table borders)

## Typography
- Display font: Fraunces
- Body font: Albert Sans
- Mono font: IBM Plex Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 20 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: text on the left, rounded photo inset on a --surface backdrop on the right
- key-figures (s2): heading and figure cards, the first card filled with --accent
- chart (s3): heading, editable chart on the left, takeaway on the right
- section (s4): centered section number, title and one line
- two-columns (s5): heading, two columns each with icon, subheading and paragraph
- image-text (s6): photo on the left over an offset --accent frame, text column on the right
- table (s7): heading and a full width table with a header row
- quote (s8): centered quote, author and role on --surface
- timeline (s9): heading and four numbered milestone cards linked by chevrons
- text (s10): heading, bullet or numbered list, side panel with icon and callout (or code)
- team (s11): heading and four members (initials avatar, name, role, one line)
- thank-you (s12): closing title, subtitle and contacts on the left, photo on the right

## Style
- Header accent: an --accent dot before the kicker.
- Background pattern on content slides: two thin --border rings bleeding off the top right corner (shapes, z 0).

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Magazines mis à plat, studios de création, micros et salles de concert, tons chauds et feutrés.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: magazine flat lay, camera content creator, microphone podcast, audience concert.
- `public/images/magazine.webp`: Magazine ouvert, tasse et rouge à lèvres sur une table, by kaboompics (https://pixabay.com/photos/red-lipgloss-lip-gloss-lipstick-792139/)
- `public/images/studio.webp`: Studio de tournage avec fond vert et éclairages, by LadyQuester (https://pixabay.com/photos/film-studio-chomakey-studio-5366454/)
- `public/images/mic.webp`: Micro de studio sur fond clair, by Pexels (https://pixabay.com/photos/audio-microphone-1844798/)
- `public/images/concert.webp`: Public d'un concert dans une lumière orangée, by thekaleidoscope (https://pixabay.com/photos/concert-live-audience-people-crowd-3387324/)

## Tone
Polished, warm, confident. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
