# Design charter: Kalo

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Plateforme de soutien scolaire pour collégiens. Chaleureuse, encourageante, ludique.

## Colors
- `--bg`: #fffaf3
  - Page and slide background
- `--surface`: #ffffff
  - Cards, panels and inputs
- `--fg`: #1f2a44
  - Main text
- `--muted`: #55607a
  - Secondary text
- `--accent`: #c2410c
  - Brand accent: buttons, links, highlights
- `--border`: #f0e4d4
  - Hairlines, dividers and input borders
- `--accent-contrast`: #ffffff
  - Text and icons on the accent colour
- `--secondary`: #1d4ed8
  - Secondary brand colour
- `--success`: #15803d
  - Positive status
- `--warning`: #a16207
  - Warning status
- `--danger`: #b91c1c
  - Errors and destructive actions
- `--info`: #1d4ed8
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 13.73 to 1 (AAA), body text
- fg on surface: 14.26 to 1 (AAA), text on cards
- muted on bg: 6.05 to 1 (AA), secondary text
- muted on surface: 6.29 to 1 (AA), secondary text on cards
- accent on bg: 4.99 to 1 (AA), accent elements and large text
- accent-contrast on accent: 5.18 to 1 (AA), button label
- success on bg: 4.83 to 1 (AA), status colour
- warning on bg: 4.74 to 1 (AA), status colour
- danger on bg: 6.23 to 1 (AA), status colour
- info on bg: 6.45 to 1 (AA), status colour

## Typography
- Display font: Fredoka
- Body font: Nunito
- Mono font: Space Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap");
- Type scale: text-xs 12px, text-sm 14px, text-base 17px, text-lg 21px, text-xl 27px, text-2xl 33px, text-3xl 42px, text-4xl 52px, text-5xl 65px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 10px, radius-md 14px, radius-lg 24px, radius-xl 36px, radius-full 9999px

## Motion
- motion-fast 100ms, motion-base 200ms, motion-slow 320ms, ease-standard cubic-bezier(0.3, 0, 0, 1)

## Iconography
- Library: lucide, style: duotone
Icônes généreuses, l'accent souligne la progression.
- Do: Étoiles et badges pour les réussites
- Do: Icônes de matière cohérentes
- Don't: Icônes punitives (croix rouges en série)
- Don't: Pictogrammes trop détaillés

## Imagery
Illustrations colorées et rondes, élèves variés et souriants.
- Do: Illustrations plates aux formes rondes
- Do: Scènes de classe et de maison
- Don't: Photos de manuels scolaires
- Don't: Clichés de génie en blouse

## Tone of voice
Encourageant et concret. L'erreur est une étape.
- Do: Féliciter l'effort
- Do: Consignes en une phrase
- Do: Tutoyer
- Don't: Ironie
- Don't: Comparer les élèves entre eux
- Don't: Mots de plus de trois syllabes sans besoin

## Logo
- File: /brand/logo.svg
- Clear space: La moitié de la hauteur du logo
- Minimum size: 28px
- Couleur sur fond clair
- Blanc sur l'orange pour les badges
- Don't: Ajouter des yeux ou une mascotte au logo
- Don't: Contour épais autour
- Don't: Plus de deux couleurs

## Do / Don't
Progression visible à chaque instant, jamais de cul-de-sac.
- Do: Barre de progression sur chaque leçon
- Do: Retour immédiat à chaque réponse
- Don't: Pages de texte sans respiration
- Don't: Plus de trois choix par question

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap");

:root {
  --bg: #fffaf3;
  --surface: #ffffff;
  --fg: #1f2a44;
  --muted: #55607a;
  --accent: #c2410c;
  --border: #f0e4d4;
  --accent-contrast: #ffffff;
  --secondary: #1d4ed8;
  --success: #15803d;
  --warning: #a16207;
  --danger: #b91c1c;
  --info: #1d4ed8;
  --font-display: Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: Nunito, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 17px;
  --text-lg: 21px;
  --text-xl: 27px;
  --text-2xl: 33px;
  --text-3xl: 42px;
  --text-4xl: 52px;
  --text-5xl: 65px;
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
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 24px;
  --radius-xl: 36px;
  --radius-full: 9999px;
  --shadow-sm: 0px 1px 2px 0px #0000000f;
  --shadow-md: 0px 4px 12px -2px #0000001a;
  --shadow-lg: 0px 12px 32px -8px #00000029;
  --motion-fast: 100ms;
  --motion-base: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.3, 0, 0, 1);
  --icon-library: lucide;
  --icon-style: duotone;
  --icon-stroke: 2px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: Nunito, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
