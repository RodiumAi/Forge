# Slides templates: style guide

Specification of the 36 Forge slides kits, all shipped in `data/templates/`. The general starter kit contract and the checks run by `apps/api/tests/test_template_slides.py` are in [TEMPLATES.md](../TEMPLATES.md). Sources and licences: [slides-sources.md](./slides-sources.md). The build scripts are in `apps/api/scripts/slides_kits/`.

## 1. Kit format

```
data/templates/slides-<name>/
├── template.json      kind "slides", bilingual title/description/bootHint, palette, fonts, transitionPreset, layouts
├── DESIGN.md          charter: tokens, fonts, layouts, transitions, imagery, credits, do/don't
├── deck.json          contract deck.schema.json (16:9, 1920 x 1080)
├── slides/s1.json ... one file per slide, contract slide.schema.json
├── notes/s1.md ...    speaker notes, French, two or three sentences
├── public/images/     WebP only, 1280 px on the long side in the current kits
├── preview.html       static mockup laid out at 480 x 300, no script, no remote URL (inline data: images allowed)
└── preview.png        gallery card: the top 480 x 270 of preview.html at 2x (scripts/render_template_previews.py)
```

- Id: `slides-<name>`, matching `^[a-z0-9][a-z0-9-]{1,62}$`.
- 8 to 12 slides. Each of the 12 layouts below appears at least once; `template.json` maps every layout to its example slide: `"layouts": { "title": "s1", "section": "s2", ... }`. The current kits have exactly 12 slides, one per layout.
- The AI and the editor's "add slide" menu do not read these example slides: they use their own layout list (`apps/api/app/services/deck_ai/layouts.py`, mirrored by `apps/web/components/deck-editor/layouts.ts`), which names two layouts differently (`key-numbers`, `thanks`).
- Example content in French, realistic and specific (names, figures, dates). Contact details use the reserved `.example` domain.
- Every color is a theme token (`--bg`, `--accent`...). Every image, background images included, is credited (`credit.source`, `author`, `url`). Every icon is a lucide name.
- Kit under 3 MB. No U+2014 long dash anywhere.
- `template.json` example:

```json
{
  "kind": "slides",
  "id": "slides-pitch-startup",
  "title": { "fr": "Pitch deck startup", "en": "Startup pitch deck" },
  "description": { "fr": "...", "en": "..." },
  "tags": ["pitch", "startup", "fundraising", "dark"],
  "category": "business",
  "preview": "preview.html",
  "bootHint": { "fr": "...", "en": "..." },
  "accent": "#4F7CFF", "bg": "#0B1020", "fg": "#F4F6FB", "muted": "#9AA3BF",
  "tone": "ambitious, crisp, data-driven",
  "fonts": { "display": "Sora", "body": "Inter", "mono": "JetBrains Mono" },
  "transitionPreset": "dynamic",
  "layouts": { "title": "s1", "section": "s2", "text": "s3", "...": "..." }
}
```

## 2. Theme tokens

Every `DESIGN.md` lists these tokens in the charter format (`- \`--token\`: #rrggbb (role)`), read by the player (`themeTokensFromDesign`) and by the AI:

| Token | Role |
|---|---|
| `--bg` | slide background |
| `--surface` | cards, panels, quote and section slides |
| `--fg` | main text (AA contrast on `--bg` and `--surface`) |
| `--muted` | secondary text, captions, footers |
| `--accent` | accent bar, numbers, icons, first chart series |
| `--accent-2` | second chart series, rare highlights |
| `--accent-contrast` | text on `--accent` |
| `--border` | hairlines, table borders, timeline line |

Fonts: `- Display font:`, `- Body font:`, `- Mono font:` lines, families from the curated `GOOGLE_FONTS` list of `apps/api/app/services/brand_charter.py` only. Text elements reference roles (`display`, `body`, `mono`), never family names.

## 3. The 12 layouts (16:9, 1920 x 1080)

Safe margins 140 px left and right. Content slides share a header: accent bar (80 x 8 at x 140, y 100, `matchKey: "accent-bar"`), kicker label (y 126, 24 px uppercase, 3 px tracking, `--accent`), heading (y 176, 64 px display, `matchKey: "slide-title"`), and a footer (deck name at x 140 and page number right aligned, y 1000, 20 px `--muted`).

| Layout | Content | Geometry |
|---|---|---|
| `title` | label, title, subtitle, meta line | full: photo background with `--bg` overlay 0.6 to 0.8, text column x 140 w 1500. split: photo x 1000 w 920 full height, text column x 140 w 820. Title 88 to 160 px. |
| `section` | big number, title, one line | number 200 px `--accent` at y 250, bar y 510, title 88 px at y 550, subtitle 34 px at y 770. Photo with strong overlay or `--surface`. |
| `text` | heading, bullet or numbered list (4 to 5 items), side panel | list x 140 w 1060 at y 360, 34 px, line height 1.55. Panel x 1300 w 480 h 560 `--surface` with an icon and a callout, or a `code` element in tech kits. |
| `two-columns` | heading, two columns: icon, subheading, paragraph | columns at x 140 and x 1000, w 780; icon 64 px at y 380, subheading 40 px at y 470, paragraph 30 px `--muted` at y 548; vertical divider at x 950. |
| `image-text` | photo, kicker, heading, paragraph, 3 bullets | photo x 0 w 880 full height; text column x 1000 w 780. |
| `quote` | quote mark, quote, author, role | `--surface` background, mark 240 px `--accent`, quote 52 to 72 px display italic at y 370, author 30 px bold at y 820. |
| `key-figures` | 3 or 4 figures: value, label, detail | cards y 380 h 460, 40 px gap, value 100 px (3 cards) or 76 px (4 cards) `--accent`. Values of 7 characters at most. |
| `chart` | editable chart, takeaway, comment | chart x 140 y 350 w 1080 h 600 (bar, line or pie, series in `--accent`, `--accent-2`, `--muted`); takeaway 40 px and comment 26 px at x 1320 w 460. |
| `table` | header row and 3 to 5 rows | x 140 y 360 w 1640, 28 px, header `--surface`, borders `--border`, relative `columnWidths`. |
| `team` | 4 people: initials avatar, name, role, one line | 4 columns; ellipse 200 px `--surface` stroked `--accent` with initials (no portrait photos by default); name 32 px, role 24 px `--accent`, bio 22 px `--muted`. |
| `timeline` | 4 milestones: date, title, one line | line x 140 y 598 w 1640 h 4 `--border`; dots 32 px `--accent`; date 34 px above, title 30 px and line 24 px below. |
| `thank-you` | closing title, subtitle, 2 contact lines | gradient `--bg` to `--surface` or photo with overlay; title 112 to 180 px at y 300; contacts with lucide icons at y 730 and 810. |

This is the base geometry of `apps/api/scripts/slides_kits/kitlib.py`. Many kits change the decoration on top of it (cover variant, header accent, background pattern, card or circle treatments) through `kitvariants.py` or `kitstyle_f2.py`, keeping the same element ids.

The deck contract accepts other layout names (lowercase letters, digits and hyphens), so a kit may add extra layouts on top of the 12; none of the current kits does.

Text sizes never go under 22 px on the 1920 canvas; split a slide instead of shrinking.

## 4. Transition presets

| Preset | Id | Slide transition | Element animations |
|---|---|---|---|
| Sobre | `sober` | `fade` 500 ms everywhere | none on titles; list items, figures and timeline steps `appear` after the previous one |
| Dynamique | `dynamic` | `push` left 600 ms, ease-out; first slide `fade` | titles `rise` on enter; body `rise` after previous; figures `pop` |
| Élégant | `elegant` | `morph` 800 ms, ease-in-out; first slide `fade` | accent bar and heading share `matchKey` (`accent-bar`, `slide-title`) and glide; titles `mask-reveal` up; body `appear` |

One preset per template, applied to all slides.

## 5. The 36 templates

Columns: colors in order `--bg` / `--surface` / `--fg` / `--muted` / `--accent` / `--accent-2` / `--border` (`--accent-contrast` is white on dark accents, near black on light ones). Fonts: display / body / mono. Hero: `full` (photo background) or `split` (photo half).

### Business (8)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-pitch-startup` | Pitch deck startup / Startup pitch deck | #0B1020 / #151C33 / #F4F6FB / #9AA3BF / #4F7CFF / #22D3A6 / #283152 | Sora / Inter / JetBrains Mono | full, dynamic | abstract blue technology network, city night skyline, smartphone app hand, fintech mobile payment |
| `slides-fundraising` | Levée de fonds / Fundraising round | #0E0F12 / #1A1C22 / #F5F5F2 / #9C9FA8 / #C9F24D / #6EE7F9 / #2B2E36 | Unbounded / Manrope / JetBrains Mono | full, dynamic | growth abstract dark, handshake business, rocket launch, coins stack |
| `slides-quarterly-review` | Revue trimestrielle / Quarterly review | #F7F8FA / #FFFFFF / #111827 / #5B6474 / #2457D6 / #F59E0B / #DDE2EA | Plus Jakarta Sans / Inter / IBM Plex Mono | split, sober | modern office building glass, business meeting office table, white architecture abstract, warehouse logistics |
| `slides-annual-report` | Rapport annuel / Annual report | #FBFAF7 / #F1EDE4 / #1F1D1A / #6A655C / #1E5B4F / #C08A2E / #DDD6C8 | Newsreader / Public Sans / IBM Plex Mono | full, elegant | aerial landscape fields, city sunrise, factory modern, people working together from behind |
| `slides-sales-proposal` | Proposition commerciale / Sales proposal | #FFFFFF / #F3F6FB / #0F172A / #5A6578 / #0F766E / #F97316 / #E2E8F0 | Outfit / Inter / JetBrains Mono | split, sober | handshake meeting, contract signing desk, team workshop sticky notes, customer service |
| `slides-strategic-plan` | Plan stratégique / Strategic plan | #10141C / #1A2030 / #EEF1F6 / #95A0B4 / #F2A93B / #5EA0FF / #2A3346 | Archivo / IBM Plex Sans / IBM Plex Mono | full, elegant | mountain summit path, chess strategy, compass map, road horizon |
| `slides-market-research` | Étude de marché / Market research | #F6F7F4 / #FFFFFF / #1B1F1A / #5F665C / #3B6E3F / #D96C3B / #DCE1D6 | Schibsted Grotesk / Work Sans / IBM Plex Mono | split, sober | market stall shopping, people shopping street, data analysis laptop, supermarket aisle |
| `slides-product-launch` | Lancement produit / Product launch | #0A0A0F / #16161F / #FAFAFA / #A1A1AA / #FF4D2E / #FFB020 / #27272F | Syne / DM Sans / JetBrains Mono | full, dynamic | product spotlight dark, gift box reveal, smartphone studio, confetti celebration |

### Marketing (6)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-brand-presentation` | Présentation de marque / Brand presentation | #FFF7F2 / #FBE7DA / #2A1A14 / #7A5F52 / #E2552D / #2F5D62 / #F0D2C0 | DM Serif Display / DM Sans / IBM Plex Mono | split, elegant | brand mood flat lay, textile texture, coffee shop interior, packaging craft paper |
| `slides-campaign` | Campagne marketing / Marketing campaign | #FFFDF5 / #FFF1C2 / #1A1A1A / #5E5A4E / #FF3D7F / #3B82F6 / #EFE3B5 | Bricolage Grotesque / Figtree / Space Mono | full, dynamic | colorful crowd festival, billboard city, megaphone, social media phone |
| `slides-case-studies` | Études de cas / Case studies | #F5F6F8 / #FFFFFF / #121417 / #5C6370 / #4338CA / #10B981 / #DFE2E8 | Hanken Grotesk / Inter / IBM Plex Mono | split, sober | before after renovation, factory workers safety, laptop analytics, team celebrating success |
| `slides-agency-portfolio` | Portfolio d'agence / Agency portfolio | #111111 / #1C1C1C / #F4F1EA / #A39E93 / #F4D35E / #EE6352 / #2E2E2E | Archivo Black / Instrument Sans / Space Mono | full, dynamic | creative studio, graphic design desk, poster wall, photography studio lights |
| `slides-media-kit` | Kit média / Media kit | #FDF8F4 / #F6E9DF / #26201C / #7B6D63 / #C2477A / #E9A23B / #EBD9CC | Fraunces / Albert Sans / IBM Plex Mono | split, elegant | magazine flat lay, camera content creator, microphone podcast, audience concert |
| `slides-product-roadmap` | Roadmap produit / Product roadmap | #0F1115 / #181B22 / #ECEEF2 / #9198A5 / #7C5CFF / #2DD4BF / #262A33 | Space Grotesk / Inter / JetBrains Mono | full, sober | road through mountains, milestones path, sticky notes board, sunrise horizon |

### Education (6)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-course-lesson` | Cours / Lesson | #FFF8EE / #FBEBD4 / #2B2118 / #6E5E4E / #2F7D4F / #E8833A / #EAD3B4 | Fraunces / Nunito Sans / JetBrains Mono | split, sober | green leaf macro, forest sunlight trees, seedling plant soil, microscope laboratory |
| `slides-thesis-defense` | Soutenance / Thesis defense | #FFFFFF / #F2F4F7 / #101828 / #556070 / #1D3E8C / #B42318 / #D9DEE6 | Source Serif 4 / IBM Plex Sans / IBM Plex Mono | split, sober | university library, laboratory research, books stack, graduation |
| `slides-school-presentation` | Exposé scolaire / School presentation | #FFFBEA / #FFF0B3 / #1E2A3A / #586474 / #FF6B35 / #2EC4B6 / #F2DE8C | Fredoka / Nunito / Space Mono | full, dynamic | planet earth space, volcano, animals wildlife, world map |
| `slides-workshop` | Atelier / Workshop | #F4F1FF / #E7E0FF / #1F1937 / #625A80 / #6D28D9 / #F59E0B / #D7CCF7 | Lexend / Lexend / JetBrains Mono | split, dynamic | workshop sticky notes, hands brainstorming, whiteboard markers, coffee break table |
| `slides-science-conference` | Conférence scientifique / Scientific talk | #0D1B2A / #15263A / #E8EEF5 / #93A4B8 / #48CAE4 / #F4A261 / #23384F | IBM Plex Sans / IBM Plex Sans / IBM Plex Mono | full, sober | microscope cells, telescope stars, dna abstract, laboratory glassware |
| `slides-internal-training` | Formation interne / Internal training | #F8FAFC / #FFFFFF / #0F172A / #546072 / #0EA5E9 / #22C55E / #DCE3EB | Onest / Onest / JetBrains Mono | split, sober | office training session, laptop learning, notebook pen desk, team coaching |

### Tech (6)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-product-demo` | Démo produit / Product demo | #090D14 / #111826 / #E6EDF7 / #8B98AD / #22D3EE / #A78BFA / #1F2A3C | Space Grotesk / Inter / JetBrains Mono | full, dynamic | laptop code dark, server data center, circuit board macro, fiber optic network |
| `slides-architecture` | Architecture technique / Architecture overview | #0F1419 / #182029 / #E6E1CF / #9A9583 / #FFB454 / #59C2FF / #253040 | Space Grotesk / IBM Plex Sans / JetBrains Mono | full, sober | server rack, network cables, building blueprint, bridge structure |
| `slides-sprint-review` | Revue de sprint / Sprint review | #F6F8FA / #FFFFFF / #1F2328 / #59636E / #8250DF / #1A7F37 / #D1D9E0 | Figtree / Inter / JetBrains Mono | split, sober | kanban board sticky notes, team standup, laptop desk, running track |
| `slides-dev-keynote` | Keynote développeurs / Developer keynote | #282A36 / #343746 / #F8F8F2 / #A4A8BE / #FF79C6 / #50FA7B / #44475A | Unbounded / Inter / JetBrains Mono | full, dynamic | conference stage lights, code screen, audience hall, neon lights |
| `slides-dev-onboarding` | Onboarding développeur / Developer onboarding | #ECEFF4 / #FFFFFF / #2E3440 / #5E6779 / #5E81AC / #A3BE8C / #D8DEE9 | Manrope / Manrope / JetBrains Mono | split, sober | welcome desk office, laptop keyboard, coffee mug code, team lunch |
| `slides-post-mortem` | Post-mortem / Incident post-mortem | #121212 / #1D1D1D / #EDEDED / #9E9E9E / #FF5F56 / #FFBD2E / #2C2C2C | IBM Plex Sans / IBM Plex Sans / IBM Plex Mono | full, sober | warning sign, storm clouds, broken glass, fire extinguisher |

### Creative and personal (6)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-portfolio` | Portfolio / Portfolio | #F4EFE8 / #EAE1D4 / #1C1A17 / #675E55 / #A84B25 / #5B6B4E / #D6CAB9 | Playfair Display / DM Sans / IBM Plex Mono | split, elegant | interior design living room, ceramic vase still life, minimal architecture concrete, design studio desk |
| `slides-visual-resume` | CV visuel / Visual resume | #FFFFFF / #F4F4F5 / #18181B / #61616B / #2563EB / #F43F5E / #E4E4E7 | Urbanist / Urbanist / JetBrains Mono | split, elegant | workspace desk minimal, city walk, notebook coffee, mountain hike |
| `slides-wedding-event` | Mariage ou événement / Wedding or event | #FBF7F2 / #F3EAE0 / #3A2E2A / #8A7A70 / #B07D62 / #8DA399 / #E8DACB | Cormorant Garamond / Lora / IBM Plex Mono | full, elegant | wedding flowers table, rings bouquet, garden party lights, champagne glasses |
| `slides-travel` | Voyage / Travel journal | #F5F1E8 / #EAE2D2 / #23302A / #687466 / #D9822B / #2F6F8F / #D9CFBC | Young Serif / Nunito Sans / Space Mono | full, dynamic | mountain lake, beach sunset, old town street, road trip van |
| `slides-moodboard` | Moodboard / Moodboard | #EFEDE8 / #E2DED6 / #1D1C1A / #6C6862 / #9C6644 / #7F8C6E / #D3CEC4 | Bodoni Moda / Albert Sans / Space Mono | split, elegant | fabric texture, dried flowers, paper texture, ceramic bowls |
| `slides-personal-review` | Bilan personnel / Year in review | #1B1626 / #261F35 / #F3EEFA / #A79CBB / #F7A072 / #9F86C0 / #352C47 | Bricolage Grotesque / Figtree / Space Mono | full, dynamic | fireworks night, journal notebook, sunrise mountain, calendar desk |

### Minimal (4)

| Id | Title fr / en | Colors | Fonts | Hero, preset | Pixabay search terms |
|---|---|---|---|---|---|
| `slides-minimal-light` | Minimal clair / Minimal light | #FFFFFF / #F5F5F5 / #111111 / #6B6B6B / #111111 / #9A9A9A / #E5E5E5 | Instrument Sans / Instrument Sans / JetBrains Mono | split, elegant | minimal white wall shadow, paper texture, white architecture |
| `slides-minimal-dark` | Minimal sombre / Minimal dark | #0A0A0A / #141414 / #F2F2F2 / #8F8F8F / #E8C468 / #BDBDBD / #2A2A2A | Instrument Serif / Instrument Sans / JetBrains Mono | full, elegant | black and white architecture, minimal shadow light, minimal horizon sea, sand dune texture |
| `slides-editorial` | Éditorial / Editorial | #F7F3EC / #EFE8DC / #141414 / #5C574F / #B3261E / #141414 / #DDD4C4 | EB Garamond / Newsreader / IBM Plex Mono | split, elegant | newspaper texture, reading room, ink pen paper, black and white portrait from behind |
| `slides-monochrome` | Monochrome / Monochrome | #1E2A44 / #26365A / #F1F4FA / #A9B6D1 / #FFFFFF / #7F95C4 / #34466E | Archivo / Archivo / IBM Plex Mono | full, sober | blue monochrome architecture, ocean waves blue, blue sky minimal |

## 6. Imagery rules

- Pixabay only, `image_type=photo`, `safesearch=true`; prefer photos without recognizable faces or brands (no logos on products, people from behind or at a distance).
- 2 to 4 photos per kit, 1280 px on the long side in the current kits (the size the Pixabay API returns, see [slides-sources.md](./slides-sources.md)), WebP quality about 80; the whole kit stays under 3 MB.
- Full-bleed photos always sit under a `--bg` overlay (0.6 to 0.85) so text keeps AA contrast.
- Credit every image: `{ "source": "pixabay", "author": "<user>", "url": "<pixabay page>" }`, and list files with authors in `DESIGN.md ## Imagery`.
- Team slides use initials avatars, not stock portraits.

## 7. Writing rules for example content

- French, one idea per slide, six lines at most, titles under 50 characters, figures put forward.
- Realistic and coherent numbers (totals add up, percentages match the chart).
- Speaker notes in `notes/<id>.md`: what to say or show, two or three sentences.
- No long dash (U+2014): use a colon, a comma or parentheses.
