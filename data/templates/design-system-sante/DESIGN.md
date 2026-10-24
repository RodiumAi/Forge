# Design charter: Soina

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Téléconsultation et suivi de santé pour les familles. Bienveillant, clair, accessible.

## Colors
- `--bg`: #fbfaf6
  - Page and slide background
- `--surface`: #ffffff
  - Cards, panels and inputs
- `--fg`: #16302b
  - Main text
- `--muted`: #4b635d
  - Secondary text
- `--accent`: #0f766e
  - Brand accent: buttons, links, highlights
- `--border`: #dfe7e3
  - Hairlines, dividers and input borders
- `--accent-contrast`: #ffffff
  - Text and icons on the accent colour
- `--secondary`: #7c9a3d
  - Secondary brand colour
- `--success`: #15803d
  - Positive status
- `--warning`: #a16207
  - Warning status
- `--danger`: #b42318
  - Errors and destructive actions
- `--info`: #1e6091
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 13.48 to 1 (AAA), body text
- fg on surface: 14.08 to 1 (AAA), text on cards
- muted on bg: 6.2 to 1 (AA), secondary text
- muted on surface: 6.48 to 1 (AA), secondary text on cards
- accent on bg: 5.24 to 1 (AA), accent elements and large text
- accent-contrast on accent: 5.47 to 1 (AA), button label
- success on bg: 4.8 to 1 (AA), status colour
- warning on bg: 4.71 to 1 (AA), status colour
- danger on bg: 6.29 to 1 (AA), status colour
- info on bg: 6.41 to 1 (AA), status colour

## Typography
- Display font: Lexend
- Body font: Nunito Sans
- Mono font: IBM Plex Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
- Type scale: text-xs 13px, text-sm 15px, text-base 18px, text-lg 22px, text-xl 26px, text-2xl 31px, text-3xl 37px, text-4xl 45px, text-5xl 54px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 8px, radius-md 12px, radius-lg 20px, radius-xl 30px, radius-full 9999px

## Motion
- motion-fast 200ms, motion-base 400ms, motion-slow 700ms, ease-standard cubic-bezier(0.4, 0, 0.2, 1)

## Iconography
- Library: lucide, style: outline
Icônes rondes et douces, toujours avec un libellé.
- Do: Libellé sous chaque icône d'action
- Do: Grandes zones de toucher (44 px)
- Don't: Icônes anatomiques réalistes
- Don't: Seringues ou sang

## Imagery
Moments du quotidien, lumière douce, personnes de tous âges.
- Do: Familles et soignants en situation réelle
- Do: Couleurs chaudes et naturelles
- Don't: Blouses blanches posées en studio
- Don't: Images médicales anxiogènes

## Tone of voice
Bienveillant et précis. On rassure sans minimiser.
- Do: Mots simples, phrases courtes
- Do: Dire quoi faire ensuite
- Do: Vouvoyer
- Don't: Jargon médical non expliqué
- Don't: Humour sur les symptômes
- Don't: Promesses de guérison

## Logo
- File: /brand/logo.svg
- Clear space: La hauteur de la lettre S tout autour
- Minimum size: 32px
- Sur fond crème ou blanc
- Version blanche sur la sarcelle
- Don't: Utiliser une croix médicale à côté du logo
- Don't: Recolorer en rouge
- Don't: Réduire sous 32 px

## Do / Don't
Accessibilité d'abord : texte 18 px, contraste AAA quand c'est possible.
- Do: Texte de base à 18 px
- Do: Contraste AAA pour le texte courant
- Do: Une seule tâche par écran
- Don't: Couleur comme seul signal
- Don't: Délais courts sur les messages
- Don't: Formulaires de plus de 5 champs

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");

:root {
  --bg: #fbfaf6;
  --surface: #ffffff;
  --fg: #16302b;
  --muted: #4b635d;
  --accent: #0f766e;
  --border: #dfe7e3;
  --accent-contrast: #ffffff;
  --secondary: #7c9a3d;
  --success: #15803d;
  --warning: #a16207;
  --danger: #b42318;
  --info: #1e6091;
  --font-display: Lexend, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: "Nunito Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 13px;
  --text-sm: 15px;
  --text-base: 18px;
  --text-lg: 22px;
  --text-xl: 26px;
  --text-2xl: 31px;
  --text-3xl: 37px;
  --text-4xl: 45px;
  --text-5xl: 54px;
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
  --shadow-sm: 0px 1px 2px 0px #0000000f;
  --shadow-md: 0px 4px 12px -2px #0000001a;
  --shadow-lg: 0px 12px 32px -8px #00000029;
  --motion-fast: 200ms;
  --motion-base: 400ms;
  --motion-slow: 700ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --icon-library: lucide;
  --icon-style: outline;
  --icon-stroke: 2px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: "Nunito Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
