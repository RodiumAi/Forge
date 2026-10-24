# Design charter: Keynote développeurs

## Template
- id: slides-dev-keynote
- name: Developer keynote (Keynote développeurs)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #282A36 (slide background)
- `--surface`: #343746 (cards, panels and quote slides)
- `--fg`: #F8F8F2 (main text)
- `--muted`: #A4A8BE (secondary text, captions)
- `--accent`: #FF79C6 (brand accent: bars, numbers, icons)
- `--accent-2`: #50FA7B (second chart series)
- `--accent-contrast`: #282A36 (text on --accent)
- `--border`: #44475A (hairlines, table borders)

## Typography
- Display font: Unbounded
- Body font: Inter
- Mono font: JetBrains Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 18 px. Gap between cards: 40 px.

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
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Scènes de conférence, néons et écrans de code, saturés en rose et vert, voilés de --bg.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: conference stage lights, code screen, audience hall, neon lights.
- `public/images/stage.webp`: Scène de conférence sous les projecteurs, by funnytools (https://pixabay.com/photos/theater-audience-screen-603076/)
- `public/images/code.webp`: Écran affichant du code coloré, by Pexels (https://pixabay.com/photos/code-coding-computer-data-1839406/)
- `public/images/neon.webp`: Néons roses et bleus dans le noir, by Alexas_Fotos (https://pixabay.com/photos/crystal-ball-photography-bullet-3894871/)
- `public/images/hall.webp`: Salle de conférence vue depuis le fond, by StockSnap (https://pixabay.com/photos/auditorium-stadium-bench-chairs-2603163/)

## Signature
- Content slides sit in a terminal window: chrome bar with three lights and a file path, soft pink glow.
- Kickers read like code comments (`// nouveautés`) in the mono font.
- Centered cover, section and closing slides; outlined figure cards.

## Tone
Bold, playful, technical. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
