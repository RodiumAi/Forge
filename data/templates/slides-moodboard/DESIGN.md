# Design charter: Moodboard

## Template
- id: slides-moodboard
- name: Moodboard (Moodboard)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #EFEDE8 (slide background)
- `--surface`: #E2DED6 (cards, panels and quote slides)
- `--fg`: #1D1C1A (main text)
- `--muted`: #6C6862 (secondary text, captions)
- `--accent`: #9C6644 (brand accent: bars, numbers, icons)
- `--accent-2`: #7F8C6E (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #D3CEC4 (hairlines, table borders)

## Typography
- Display font: Bodoni Moda
- Body font: Albert Sans
- Mono font: Space Mono
- Display weight: 500
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 2 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- section (s2): big section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading, two columns each with icon, subheading and paragraph
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- quote (s6): large quote mark, quote, author and role
- key-figures (s7): heading and three or four figure cards
- chart (s8): heading, editable chart on the left, takeaway on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thank-you (s12): closing title, subtitle and two contact lines with icons

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Matières en gros plan : lin, papier kraft, fleurs séchées, céramique ; lumière naturelle et douce.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: fabric texture, dried flowers, paper texture, ceramic bowls.
- `public/images/flowers.webp`: Hortensias séchés en gros plan, by AdelinaZw (https://pixabay.com/photos/hydrangea-dried-flowers-7271492/)
- `public/images/ceramic.webp`: Poteries en terre cuite empilées, by Pexels (https://pixabay.com/photos/ancient-pottery-pots-clay-antique-2179091/)
- `public/images/linen.webp`: Toile de lin naturel, by virin000 (https://pixabay.com/photos/textile-jute-brown-fabric-texture-2918844/)
- `public/images/paper.webp`: Papier kraft brut, by 566547 (https://pixabay.com/photos/recycling-paper-background-texture-520423/)

## Signature
- Crop marks in the four corners of content slides, like a print proof.
- Numbered kickers (`N°03`) in the mono font.
- Photo mosaics on the cover and image slide, with a colour swatch tile; palette slide with token chips.

## Tone
Sensory, refined, evocative. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
