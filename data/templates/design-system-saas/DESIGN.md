# Design charter: Ardoise

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Logiciel B2B de gestion de projets pour équipes produit. Clair, précis, rassurant.

## Colors
- `--bg`: #ffffff
  - Page and slide background
- `--surface`: #f8fafc
  - Cards, panels and inputs
- `--fg`: #0f172a
  - Main text
- `--muted`: #475569
  - Secondary text
- `--accent`: #2563eb
  - Brand accent: buttons, links, highlights
- `--border`: #e2e8f0
  - Hairlines, dividers and input borders
- `--accent-contrast`: #ffffff
  - Text and icons on the accent colour
- `--secondary`: #0ea5e9
  - Secondary brand colour
- `--success`: #15803d
  - Positive status
- `--warning`: #b45309
  - Warning status
- `--danger`: #b91c1c
  - Errors and destructive actions
- `--info`: #1d4ed8
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 17.85 to 1 (AAA), body text
- fg on surface: 17.06 to 1 (AAA), text on cards
- muted on bg: 7.58 to 1 (AAA), secondary text
- muted on surface: 7.24 to 1 (AAA), secondary text on cards
- accent on bg: 5.17 to 1 (AA), accent elements and large text
- accent-contrast on accent: 5.17 to 1 (AA), button label
- success on bg: 5.02 to 1 (AA), status colour
- warning on bg: 5.02 to 1 (AA), status colour
- danger on bg: 6.47 to 1 (AA), status colour
- info on bg: 6.7 to 1 (AA), status colour

## Typography
- Display font: Inter
- Body font: Inter
- Mono font: JetBrains Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
- Type scale: text-xs 12px, text-sm 13px, text-base 16px, text-lg 19px, text-xl 23px, text-2xl 28px, text-3xl 33px, text-4xl 40px, text-5xl 48px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 6px, radius-md 8px, radius-lg 12px, radius-xl 18px, radius-full 9999px

## Motion
- motion-fast 100ms, motion-base 200ms, motion-slow 320ms, ease-standard cubic-bezier(0.3, 0, 0, 1)

## Iconography
- Library: lucide, style: outline
Icônes au trait fin, toujours accompagnées d'un libellé dans la navigation.
- Do: Une seule taille par zone
- Do: Couleur du texte, accent seulement pour l'état actif
- Don't: Mélanger icônes pleines et au trait
- Don't: Icônes décoratives sans fonction

## Imagery
Captures d'interface nettes et illustrations géométriques sobres.
- Do: Captures réelles du produit
- Do: Fonds clairs et beaucoup d'air
- Don't: Photos de banque d'images génériques
- Don't: Mockups 3D surchargés

## Tone of voice
Direct, concret, sans jargon. On parle de résultats.
- Do: Phrases courtes à l'actif
- Do: Verbes d'action sur les boutons
- Do: Chiffres précis
- Don't: Superlatifs creux
- Don't: Jargon technique non expliqué
- Don't: Points d'exclamation

## Logo
- File: /brand/logo.svg
- On dark backgrounds: /brand/logo-dark.svg
- Clear space: La hauteur du symbole tout autour du logo
- Minimum size: 24px
- Sur fond blanc ou ardoise très clair
- Version blanche sur le bleu d'accent
- Don't: Déformer ou incliner le logo
- Don't: Ajouter une ombre ou un dégradé
- Don't: Le poser sur une photo chargée

## Do / Don't
La clarté avant l'effet : une action principale par écran.
- Do: Un seul bouton principal visible
- Do: Aligner sur la grille de 8 px
- Do: Contraste AA pour tout texte
- Don't: Plus de deux couleurs d'accent
- Don't: Texte gris clair sur fond blanc
- Don't: Animations de plus de 300 ms

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");

:root {
  --bg: #ffffff;
  --surface: #f8fafc;
  --fg: #0f172a;
  --muted: #475569;
  --accent: #2563eb;
  --border: #e2e8f0;
  --accent-contrast: #ffffff;
  --secondary: #0ea5e9;
  --success: #15803d;
  --warning: #b45309;
  --danger: #b91c1c;
  --info: #1d4ed8;
  --font-display: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 16px;
  --text-lg: 19px;
  --text-xl: 23px;
  --text-2xl: 28px;
  --text-3xl: 33px;
  --text-4xl: 40px;
  --text-5xl: 48px;
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
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 18px;
  --radius-full: 9999px;
  --shadow-sm: 0px 1px 2px 0px #0000000f;
  --shadow-md: 0px 4px 12px -2px #0000001a;
  --shadow-lg: 0px 12px 32px -8px #00000029;
  --motion-fast: 100ms;
  --motion-base: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.3, 0, 0, 1);
  --icon-library: lucide;
  --icon-style: outline;
  --icon-stroke: 1.75px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
