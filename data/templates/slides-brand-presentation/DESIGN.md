# Design charter: Présentation de marque

## Template
- id: slides-brand-presentation
- name: Brand presentation (Présentation de marque)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFF7F2 (slide background)
- `--surface`: #FBE7DA (cards, panels and quote slides)
- `--fg`: #2A1A14 (main text)
- `--muted`: #7A5F52 (secondary text, captions)
- `--accent`: #E2552D (brand accent: bars, numbers, icons)
- `--accent-2`: #2F5D62 (second chart series)
- `--accent-contrast`: #2A1A14 (text on --accent)
- `--border`: #F0D2C0 (hairlines, table borders)

## Typography
- Display font: DM Serif Display
- Body font: DM Sans
- Mono font: IBM Plex Mono
- Display weight: 400
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 28 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- image-text (s2): round photo with an accent ring on the left, text column on the right
- quote (s3): centered quote, author and role on --surface
- section (s4): big section number, title and one line
- two-columns (s5): heading, two columns each with icon, subheading and paragraph
- text (s6): heading, bullet or numbered list, side panel with icon and callout (or code)
- table (s7): heading and a full width table with a header row
- key-numbers (s8): heading and three or four figure cards
- chart (s9): heading, takeaway on the left, editable chart on the right
- team (s10): heading and four --surface cards (square initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thanks (s12): closing title, subtitle and contacts on the left, photo on the right

## Style
- Header accent: an 80 x 8 accent bar above the kicker.

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Matières, textiles, cafés et emballages en papier kraft, lumière chaude du matin, mises à plat.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: brand mood flat lay, textile texture, coffee shop interior, packaging craft paper.
- `public/images/flatlay.webp`: Tasses de café et grains sur une table en bois, by AdelinaZw (https://pixabay.com/photos/coffee-cups-coffee-beans-caffeine-6334106/)
- `public/images/textile.webp`: Texture de toile de lin, by virin000 (https://pixabay.com/photos/textile-jute-brown-fabric-texture-2918844/)
- `public/images/cafe.webp`: Intérieur d'un café, tables et chaises en bois, by tianya1223 (https://pixabay.com/photos/cafe-interior-furniture-tables-5635015/)
- `public/images/kraft.webp`: Papier kraft, rubans et ciseaux, by Pexels (https://pixabay.com/photos/arts-and-crafts-bows-ribbons-gift-1867323/)

## Tone
Warm, crafted, sensory. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
