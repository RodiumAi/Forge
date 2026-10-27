# Design charter: Maison Orée

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Maison de maroquinerie artisanale. Raffinée, discrète, intemporelle.

## Colors
- `--bg`: #0c0a09
  - Page and slide background
- `--surface`: #171412
  - Cards, panels and inputs
- `--fg`: #f2ece4
  - Main text
- `--muted`: #a8a097
  - Secondary text
- `--accent`: #c8a96a
  - Brand accent: buttons, links, highlights
- `--border`: #2a2521
  - Hairlines, dividers and input borders
- `--accent-contrast`: #0b0b0f
  - Text and icons on the accent colour
- `--secondary`: #8c6b3f
  - Secondary brand colour
- `--success`: #7fb38a
  - Positive status
- `--warning`: #d6b25e
  - Warning status
- `--danger`: #d98880
  - Errors and destructive actions
- `--info`: #9bb3c8
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 16.83 to 1 (AAA), body text
- fg on surface: 15.62 to 1 (AAA), text on cards
- muted on bg: 7.66 to 1 (AAA), secondary text
- muted on surface: 7.11 to 1 (AAA), secondary text on cards
- accent on bg: 8.79 to 1 (AAA), accent elements and large text
- accent-contrast on accent: 8.74 to 1 (AAA), button label
- success on bg: 8.2 to 1 (AAA), status colour
- warning on bg: 9.77 to 1 (AAA), status colour
- danger on bg: 7.32 to 1 (AAA), status colour
- info on bg: 9.1 to 1 (AAA), status colour

## Typography
- Display font: Cormorant Garamond
- Body font: Hanken Grotesk
- Mono font: IBM Plex Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
- Type scale: text-xs 12px, text-sm 13px, text-base 16px, text-lg 23px, text-xl 32px, text-2xl 45px, text-3xl 64px, text-4xl 90px, text-5xl 128px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 0px, radius-md 0px, radius-lg 2px, radius-xl 3px, radius-full 9999px

## Motion
- motion-fast 200ms, motion-base 400ms, motion-slow 700ms, ease-standard cubic-bezier(0.4, 0, 0.2, 1)

## Iconography
- Library: lucide, style: outline
Icônes très fines, rares, jamais décoratives.
- Do: Trait de 1 px
- Do: Couleur du texte atténué
- Don't: Icônes en couleur or
- Don't: Icônes dans les titres

## Imagery
Natures mortes en clair-obscur, matières en très gros plan, beaucoup de noir.
- Do: Une lumière latérale unique
- Do: Le geste de l'artisan
- Do: Grain du cuir visible
- Don't: Fonds blancs de catalogue
- Don't: Mannequins souriants
- Don't: Plus de trois produits par image

## Tone of voice
Peu de mots, choisis. On évoque, on ne vend pas.
- Do: Phrases courtes et posées
- Do: Vocabulaire de l'artisanat
- Do: Vouvoyer
- Don't: Promotions et pourcentages
- Don't: Superlatifs
- Don't: Points d'exclamation

## Logo
- File: /brand/logo.svg
- On dark backgrounds: /brand/logo-dark.svg
- Clear space: La hauteur totale du logo de chaque côté
- Minimum size: 48px
- Or sur noir
- Noir sur papier ivoire pour l'impression
- Toujours centré, avec beaucoup d'espace
- Don't: Or brillant ou effet métallique
- Don't: Logo sur une photo de produit
- Don't: Taille inférieure à 48 px

## Do / Don't
Le vide est un luxe : beaucoup d'espace, peu d'éléments, aucun bruit.
- Do: Marges généreuses
- Do: Titres en serif, texte en sans
- Do: Or réservé aux détails
- Don't: Coins arrondis
- Don't: Ombres portées
- Don't: Plus de deux tailles de texte par bloc

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");

:root {
  --bg: #0c0a09;
  --surface: #171412;
  --fg: #f2ece4;
  --muted: #a8a097;
  --accent: #c8a96a;
  --border: #2a2521;
  --accent-contrast: #0b0b0f;
  --secondary: #8c6b3f;
  --success: #7fb38a;
  --warning: #d6b25e;
  --danger: #d98880;
  --info: #9bb3c8;
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-body: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 16px;
  --text-lg: 23px;
  --text-xl: 32px;
  --text-2xl: 45px;
  --text-3xl: 64px;
  --text-4xl: 90px;
  --text-5xl: 128px;
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
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 2px;
  --radius-xl: 3px;
  --radius-full: 9999px;
  --shadow-sm: 0px 0px 0px 0px #00000000;
  --shadow-md: 0px 0px 0px 0px #00000000;
  --shadow-lg: 0px 0px 0px 0px #00000000;
  --motion-fast: 200ms;
  --motion-base: 400ms;
  --motion-slow: 700ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --icon-library: lucide;
  --icon-style: outline;
  --icon-stroke: 1px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
