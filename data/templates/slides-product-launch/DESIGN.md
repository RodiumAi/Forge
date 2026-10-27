# Design charter: Lancement produit

## Template
- id: slides-product-launch
- name: Product launch (Lancement produit)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #0A0A0F (slide background)
- `--surface`: #16161F (cards, panels and quote slides)
- `--fg`: #FAFAFA (main text)
- `--muted`: #A1A1AA (secondary text, captions)
- `--accent`: #FF4D2E (brand accent: bars, numbers, icons)
- `--accent-2`: #FFB020 (second chart series)
- `--accent-contrast`: #0A0A0F (text on --accent)
- `--border`: #27272F (hairlines, table borders)

## Typography
- Display font: Syne
- Body font: DM Sans
- Mono font: JetBrains Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 24 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo background with a --bg veil, label, title, subtitle and meta centered
- section (s2): centered section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- image-text (s4): rounded photo inset on the left, kicker, heading, paragraph and list on the right
- two-columns (s5): heading and two --surface cards, each with an icon badge, subheading and paragraph
- key-figures (s6): heading and figure cards, the first card filled with --accent
- chart (s7): heading, editable chart on the left, takeaway on the right
- quote (s8): full --accent background, quote in --accent-contrast
- table (s9): heading and a full width table with a header row
- team (s10): heading and four --surface cards (square initials avatar, name, role, one line)
- timeline (s11): heading and four numbered milestone cards linked by chevrons
- thank-you (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: an 80 x 8 accent bar above the kicker.
- Background pattern on content slides: a soft --accent glow (opacity 0.12) in the top right corner (shapes, z 0).
- Titles and headings are set in uppercase.

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Objets isolés dans le noir, éclairage de studio en douche, éclats de lumière et de couleur.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: product spotlight dark, gift box reveal, smartphone studio, confetti celebration.
- `public/images/spot.webp`: Faisceaux de lumière au-dessus d'une scène, by JanBrzezinski (https://pixabay.com/photos/performers-dancing-silhouette-dance-5644247/)
- `public/images/gift.webp`: Boîte cadeau noire sur une table en bois, by image4you (https://pixabay.com/photos/gift-present-wood-package-gift-box-1420830/)
- `public/images/studio.webp`: Boîte sombre éclairée par un faisceau de lumière, by StockSnap (https://pixabay.com/photos/dark-night-light-shadow-m-corner-2588513/)
- `public/images/confetti.webp`: Confettis rouges en forme de cœur, by NoName_13 (https://pixabay.com/photos/background-heart-hearts-shiny-2062206/)

## Tone
Bold, theatrical, punchy. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
