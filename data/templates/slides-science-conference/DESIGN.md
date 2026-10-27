# Design charter: Conférence scientifique

## Template
- id: slides-science-conference
- name: Scientific talk (Conférence scientifique)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #0D1B2A (slide background)
- `--surface`: #15263A (cards, panels and quote slides)
- `--fg`: #E8EEF5 (main text)
- `--muted`: #93A4B8 (secondary text, captions)
- `--accent`: #48CAE4 (brand accent: bars, numbers, icons)
- `--accent-2`: #F4A261 (second chart series)
- `--accent-contrast`: #0D1B2A (text on --accent)
- `--border`: #23384F (hairlines, table borders)

## Typography
- Display font: IBM Plex Sans
- Body font: IBM Plex Sans
- Mono font: IBM Plex Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 8 px. Gap between cards: 40 px.

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
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Microscopie, verrerie de laboratoire et ciel étoilé, tons bleu nuit, toujours voilés de --bg.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: microscope cells, telescope stars, dna abstract, laboratory glassware.
- `public/images/micro.webp`: Cellules observées au microscope, by PiotrZakrzewski (https://pixabay.com/photos/the-drug-biology-microscope-5197172/)
- `public/images/stars.webp`: Ciel étoilé vu depuis un observatoire, by Sunriseforever (https://pixabay.com/photos/telescope-astronomer-milky-way-7042666/)
- `public/images/dna.webp`: Visualisation abstraite d'une double hélice, by AlexAntropov86 (https://pixabay.com/photos/gene-dna-study-science-biology-6527964/)
- `public/images/lab.webp`: Verrerie de laboratoire sur une paillasse, by PublicDomainPictures (https://pixabay.com/photos/laboratory-apparatus-equipment-217041/)

## Signature
- Numbered kickers in the mono font (`03  ·  Méthodes`) give the talk a paper-like structure.
- A matrix of accent dots sits in the top right corner of content slides, like a sample plate.
- Hairline above the footer; outlined figure cards; quotes set against a vertical accent rule.

## Tone
Rigorous, clear, evidence-first. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
