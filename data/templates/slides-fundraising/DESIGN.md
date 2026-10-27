# Design charter: Levée de fonds

## Template
- id: slides-fundraising
- name: Fundraising round (Levée de fonds)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #0E0F12 (slide background)
- `--surface`: #1A1C22 (cards, panels and quote slides)
- `--fg`: #F5F5F2 (main text)
- `--muted`: #9C9FA8 (secondary text, captions)
- `--accent`: #C9F24D (brand accent: bars, numbers, icons)
- `--accent-2`: #6EE7F9 (second chart series)
- `--accent-contrast`: #0E0F12 (text on --accent)
- `--border`: #2B2E36 (hairlines, table borders)

## Typography
- Display font: Unbounded
- Body font: Manrope
- Mono font: JetBrains Mono
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
- title (s1): cover: photo background, meta and a hairline at the top, title block anchored low
- section (s2): big section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading and two --surface cards, each with an icon badge, subheading and paragraph
- key-numbers (s5): heading and figure cards, the first card filled with --accent
- chart (s6): heading, editable chart on the left, takeaway on the right
- image-text (s7): kicker, heading, paragraph and list on the left, photo on the right half
- quote (s8): full --accent background, quote in --accent-contrast
- team (s9): heading and four --surface cards (square initials avatar, name, role, one line)
- table (s10): heading and a full width table with a header row
- timeline (s11): heading and four numbered milestone cards linked by chevrons
- thanks (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: an 80 x 8 accent bar above the kicker.
- Background pattern on content slides: a 7 x 4 grid of small --border dots in the top right corner (shapes, z 0).

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Photos sombres et contrastées, lumière rasante, croissance et énergie, toujours sous un voile --bg.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: growth abstract dark, handshake business, rocket launch, coins stack.
- `public/images/hero.webp`: Feuille verte enroulée sur fond noir, by Waratharn (https://pixabay.com/photos/fern-tree-nature-1686344/)
- `public/images/launch.webp`: Décollage d'une fusée dans la nuit, by WikiImages (https://pixabay.com/photos/rocket-launch-rocket-take-off-67646/)
- `public/images/deal.webp`: Poignée de main entre deux associés, by adamr (https://pixabay.com/photos/handshake-cooperation-partnership-3298455/)
- `public/images/coins.webp`: Piles de pièces de taille croissante, by kschneider2991 (https://pixabay.com/photos/money-coins-stack-stacked-coins-2180330/)

## Tone
Confident, sharp, numbers first. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
