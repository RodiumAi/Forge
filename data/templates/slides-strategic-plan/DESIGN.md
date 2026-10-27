# Design charter: Plan stratégique

## Template
- id: slides-strategic-plan
- name: Strategic plan (Plan stratégique)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #10141C (slide background)
- `--surface`: #1A2030 (cards, panels and quote slides)
- `--fg`: #EEF1F6 (main text)
- `--muted`: #95A0B4 (secondary text, captions)
- `--accent`: #F2A93B (brand accent: bars, numbers, icons)
- `--accent-2`: #5EA0FF (second chart series)
- `--accent-contrast`: #10141C (text on --accent)
- `--border`: #2A3346 (hairlines, table borders)

## Typography
- Display font: Archivo
- Body font: IBM Plex Sans
- Mono font: IBM Plex Mono
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
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- quote (s2): quote over a photo with a strong --bg veil
- section (s3): giant section number on the right, title and one line on the left
- text (s4): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s5): heading, two columns each with icon, subheading and paragraph
- image-text (s6): photo on the left over an offset --accent frame, text column on the right
- key-numbers (s7): heading and three or four figures under accent rules, no cards
- chart (s8): heading, takeaway on the left, editable chart on the right
- timeline (s9): heading and four milestones on a horizontal line
- team (s10): heading and four members (initials avatar, name, role, one line)
- table (s11): heading and a full width table with a header row
- thanks (s12): closing title, subtitle and two contact lines with icons

## Style
- Header accent: a vertical --accent bar on the left edge beside the kicker and heading.
- Background pattern on content slides: two thin --border rings bleeding off the top right corner (shapes, z 0).
- The side panel of text slides is filled with --accent, icon and callout in --accent-contrast.

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Grands espaces, sommets, routes et cartes : l'idée de cap, en tons froids sous un voile nuit.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: mountain summit path, chess strategy, compass map, road horizon.
- `public/images/summit.webp`: Sentier de pierre vers des sommets enneigés, by kinkate (https://pixabay.com/photos/mountain-landscape-steps-stones-2031539/)
- `public/images/chess.webp`: Pièces d'échecs dans la pénombre, by Felix-Mittermeier (https://pixabay.com/photos/chess-board-game-board-game-2730034/)
- `public/images/compass.webp`: Boussole posée sur une carte, by Ylanite (https://pixabay.com/photos/compass-travel-navigation-close-up-7592447/)
- `public/images/road.webp`: Route droite dans le désert sous un ciel bleu, by jplenio (https://pixabay.com/photos/road-nevada-clouds-bird-landscape-3856796/)

## Tone
Visionary, structured, decisive. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
