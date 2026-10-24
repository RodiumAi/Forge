# Design charter: Études de cas

## Template
- id: slides-case-studies
- name: Case studies (Études de cas)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F5F6F8 (slide background)
- `--surface`: #FFFFFF (cards, panels and quote slides)
- `--fg`: #121417 (main text)
- `--muted`: #5C6370 (secondary text, captions)
- `--accent`: #4338CA (brand accent: bars, numbers, icons)
- `--accent-2`: #10B981 (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #DFE2E8 (hairlines, table borders)

## Typography
- Display font: Hanken Grotesk
- Body font: Inter
- Mono font: IBM Plex Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 16 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- section (s2): giant section number on the right, title and one line on the left
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading and two --surface cards, each with an icon badge, subheading and paragraph
- chart (s5): heading, editable chart on the left, takeaway on the right
- quote (s6): large quote mark, quote, author and role
- key-figures (s7): heading and three or four figures under accent rules, no cards
- image-text (s8): photo on the left over an offset --accent frame, text column on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thank-you (s12): closing title, subtitle and two contact lines with icons

## Style
- Header accent: an 80 x 8 accent bar above the kicker.
- A --border hairline sits above the footer (y 978).

## Transitions
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Sites industriels, chantiers, tableaux de bord et équipes de dos, lumière naturelle.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: before after renovation, factory workers safety, laptop analytics, team celebrating success.
- `public/images/site.webp`: Façade en briques sous échafaudage, by PublicDomainPictures (https://pixabay.com/photos/craftsmen-building-scaffold-19584/)
- `public/images/factory.webp`: Meuleuse et gerbe d'étincelles en atelier, by jannonivergall (https://pixabay.com/photos/worker-grinder-factory-workplace-5736096/)
- `public/images/analytics.webp`: Ordinateur portable affichant des graphiques, by Pexels (https://pixabay.com/photos/laptop-notebook-business-charts-1836990/)
- `public/images/team.webp`: Mains réunies au centre d'une équipe, by jarmoluk (https://pixabay.com/photos/hands-friendship-friends-children-2847508/)

## Tone
Credible, concrete, results-driven. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
