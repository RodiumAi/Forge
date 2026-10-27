# Design charter: Exposé scolaire

## Template
- id: slides-school-presentation
- name: School presentation (Exposé scolaire)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFFBEA (slide background)
- `--surface`: #FFF0B3 (cards, panels and quote slides)
- `--fg`: #1E2A3A (main text)
- `--muted`: #586474 (secondary text, captions)
- `--accent`: #FF6B35 (brand accent: bars, numbers, icons)
- `--accent-2`: #2EC4B6 (second chart series)
- `--accent-contrast`: #1E2A3A (text on --accent)
- `--border`: #F2DE8C (hairlines, table borders)

## Typography
- Display font: Fredoka
- Body font: Nunito
- Mono font: Space Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 32 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- section (s3): centered section number, title and one line
- image-text (s4): round photo with an accent ring on the left, text column on the right
- two-columns (s5): heading and two --surface cards, each with an icon badge, subheading and paragraph
- key-figures (s6): heading and figure cards, the first card filled with --accent
- table (s7): heading and a full width table with a header row
- chart (s8): heading, editable chart on the left, takeaway on the right
- quote (s9): quote over a photo with a strong --bg veil
- timeline (s10): heading and four numbered milestone cards linked by chevrons
- team (s11): heading and four members (initials avatar, name, role, one line)
- thank-you (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: an --accent dot before the kicker.
- Background pattern on content slides: two soft round shapes in --accent-2 and --accent at the top right (shapes, z 0).

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Volcans, planète et cartes du monde, couleurs franches, nature spectaculaire.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: planet earth space, volcano, animals wildlife, world map.
- `public/images/volcano.webp`: Volcan en éruption, coulée de lave la nuit, by Gylfi (https://pixabay.com/photos/volcano-lava-iceland-nature-7396466/)
- `public/images/earth.webp`: La Terre vue de l'espace sous une galaxie, by Luminas_Art (https://pixabay.com/photos/new-year-background-galaxy-star-3608029/)
- `public/images/map.webp`: Carte du monde la nuit, by WikiImages (https://pixabay.com/photos/earth-map-atlas-cartology-world-11048/)
- `public/images/bromo.webp`: Volcans au-dessus d'une mer de nuages, by Ri_Lens (https://pixabay.com/photos/mountain-volcano-cloud-sunset-10444397/)

## Tone
Friendly, curious, simple. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
