# Design charter: Soutenance

## Template
- id: slides-thesis-defense
- name: Thesis defense (Soutenance)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFFFFF (slide background)
- `--surface`: #F2F4F7 (cards, panels and quote slides)
- `--fg`: #101828 (main text)
- `--muted`: #556070 (secondary text, captions)
- `--accent`: #1D3E8C (brand accent: bars, numbers, icons)
- `--accent-2`: #B42318 (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #D9DEE6 (hairlines, table borders)

## Typography
- Display font: Source Serif 4
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
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- section (s3): centered section number, title and one line
- two-columns (s4): heading, two columns each with icon, subheading and paragraph
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- key-figures (s6): heading and three or four figures under accent rules, no cards
- chart (s7): heading, editable chart on the left, takeaway on the right
- table (s8): heading and a full width table with a header row
- quote (s9): centered quote, author and role on --surface
- timeline (s10): heading and four milestones on a horizontal line
- team (s11): heading and four members (initials avatar, name, role, one line)
- thank-you (s12): closing title, subtitle and two contact lines with icons

## Style
- Header accent: a hairline across the slide top with a short --accent segment.
- A --border hairline sits above the footer (y 978).

## Transitions
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Bibliothèques, laboratoires et livres, lumière froide et nette, sans portrait.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: university library, laboratory research, books stack, graduation.
- `public/images/library.webp`: Longue salle de bibliothèque aux rayonnages de bois, by IdaT (https://pixabay.com/photos/library-books-bookshelves-bookcases-5612441/)
- `public/images/lab.webp`: Objectifs de microscope en gros plan, by Kost9n4 (https://pixabay.com/photos/analysis-biochemistry-biologist-2030265/)
- `public/images/books.webp`: Livre ouvert dont les pages forment un cœur, by Veronika_Andrews (https://pixabay.com/photos/books-heart-pages-literature-5615562/)
- `public/images/grad.webp`: Toques lancées en l'air lors d'une remise de diplômes, by greymatters (https://pixabay.com/photos/graduation-teen-high-school-student-995042/)

## Tone
Rigorous, clear, modest. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
