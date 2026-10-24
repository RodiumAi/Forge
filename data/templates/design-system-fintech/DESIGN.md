# Design charter: Nuvia

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Néobanque mobile pour les indépendants d'Afrique de l'Ouest. Sûre, moderne, sereine.

## Colors
- `--bg`: #0b1220
  - Page and slide background
- `--surface`: #131c2e
  - Cards, panels and inputs
- `--fg`: #e8eef8
  - Main text
- `--muted`: #94a3b8
  - Secondary text
- `--accent`: #10b981
  - Brand accent: buttons, links, highlights
- `--border`: #22304a
  - Hairlines, dividers and input borders
- `--accent-contrast`: #0b0b0f
  - Text and icons on the accent colour
- `--secondary`: #38bdf8
  - Secondary brand colour
- `--success`: #34d399
  - Positive status
- `--warning`: #fbbf24
  - Warning status
- `--danger`: #f87171
  - Errors and destructive actions
- `--info`: #60a5fa
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 16.06 to 1 (AAA), body text
- fg on surface: 14.61 to 1 (AAA), text on cards
- muted on bg: 7.3 to 1 (AAA), secondary text
- muted on surface: 6.64 to 1 (AA), secondary text on cards
- accent on bg: 7.38 to 1 (AAA), accent elements and large text
- accent-contrast on accent: 7.74 to 1 (AAA), button label
- success on bg: 9.74 to 1 (AAA), status colour
- warning on bg: 11.22 to 1 (AAA), status colour
- danger on bg: 6.77 to 1 (AA), status colour
- info on bg: 7.36 to 1 (AAA), status colour

## Typography
- Display font: Manrope
- Body font: Manrope
- Mono font: IBM Plex Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
- Type scale: text-xs 12px, text-sm 13px, text-base 16px, text-lg 20px, text-xl 25px, text-2xl 31px, text-3xl 39px, text-4xl 49px, text-5xl 61px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 8px, radius-md 12px, radius-lg 20px, radius-xl 30px, radius-full 9999px

## Motion
- motion-fast 150ms, motion-base 300ms, motion-slow 500ms, ease-standard cubic-bezier(0.2, 0, 0, 1)

## Iconography
- Library: lucide, style: outline
Icônes nettes et lisibles, l'émeraude réservée aux actions positives.
- Do: Flèches pour les flux d'argent
- Do: Cadenas pour la sécurité
- Don't: Icônes de pièces ou de billets clichés
- Don't: Rouge hors des alertes

## Imagery
Portraits d'entrepreneurs en lumière naturelle, couleurs désaturées.
- Do: Vraies personnes au travail
- Do: Cadrages serrés et sereins
- Don't: Billets et pièces en gros plan
- Don't: Graphiques boursiers décoratifs

## Tone of voice
Rassurant et transparent. Chaque frais est annoncé avant l'action.
- Do: Montants exacts avec la devise
- Do: Expliquer ce qui va se passer
- Do: Tutoyer avec respect
- Don't: Promesses de gains
- Don't: Petites lignes cachées
- Don't: Urgence artificielle

## Logo
- File: /brand/logo.svg
- Clear space: La moitié de la hauteur du logo
- Minimum size: 28px
- Version claire sur le bleu nuit
- Symbole seul pour l'icône d'application
- Don't: Changer la couleur émeraude
- Don't: Placer le logo sur un fond rouge
- Don't: Animer le logo

## Do / Don't
La confiance se lit dans la constance : mêmes composants, mêmes mots.
- Do: Chiffres en police mono alignés à droite
- Do: Confirmer chaque transfert
- Do: Contraste AA partout
- Don't: Vert pour autre chose qu'un succès
- Don't: Tableaux sans séparateurs
- Don't: Texte sous 14 px

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");

:root {
  --bg: #0b1220;
  --surface: #131c2e;
  --fg: #e8eef8;
  --muted: #94a3b8;
  --accent: #10b981;
  --border: #22304a;
  --accent-contrast: #0b0b0f;
  --secondary: #38bdf8;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
  --info: #60a5fa;
  --font-display: Manrope, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: Manrope, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 16px;
  --text-lg: 20px;
  --text-xl: 25px;
  --text-2xl: 31px;
  --text-3xl: 39px;
  --text-4xl: 49px;
  --text-5xl: 61px;
  --leading-tight: 1.15;
  --leading-snug: 1.3;
  --leading-normal: 1.55;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --radius-none: 0px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 30px;
  --radius-full: 9999px;
  --shadow-sm: 0px 1px 2px 0px #0000003d;
  --shadow-md: 0px 4px 12px -2px #00000065;
  --shadow-lg: 0px 12px 32px -8px #000000a2;
  --motion-fast: 150ms;
  --motion-base: 300ms;
  --motion-slow: 500ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --icon-library: lucide;
  --icon-style: outline;
  --icon-stroke: 2px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: Manrope, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
