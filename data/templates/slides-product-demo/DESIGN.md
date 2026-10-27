# Design charter: Démo produit

## Template
- id: slides-product-demo
- name: Product demo (Démo produit)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #090D14 (slide background)
- `--surface`: #111826 (cards, panels and quote slides)
- `--fg`: #E6EDF7 (main text)
- `--muted`: #8B98AD (secondary text, captions)
- `--accent`: #22D3EE (brand accent: bars, numbers, icons)
- `--accent-2`: #A78BFA (second chart series)
- `--accent-contrast`: #04111A (text on --accent)
- `--border`: #1F2A3C (hairlines, table borders)

## Typography
- Display font: Space Grotesk
- Body font: Inter
- Mono font: JetBrains Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 14 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- section (s2): big section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading, two columns each with icon, subheading and paragraph
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- quote (s6): large quote mark, quote, author and role
- key-numbers (s7): heading and three or four figure cards
- chart (s8): heading, editable chart on the left, takeaway on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thanks (s12): closing title, subtitle and two contact lines with icons

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Code, serveurs et électronique en très gros plan, fortement assombris, reflets cyan et violet.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: laptop code dark, server data center, circuit board macro, fiber optic network, developer workspace night.
- `public/images/code.webp`: Code source affiché sur un écran sombre, by Pexels (https://pixabay.com/photos/technology-computer-code-javascript-1283624/)
- `public/images/datacenter.webp`: Allée d'un centre de données, by Apke (https://pixabay.com/photos/server-room-data-center-computers-1376349/)
- `public/images/circuit.webp`: Circuit imprimé en gros plan, by blickpixel (https://pixabay.com/photos/circuit-board-computer-chip-564815/)

## Tone
Precise, confident, developer-friendly. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
