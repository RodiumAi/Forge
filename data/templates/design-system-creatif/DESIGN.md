# Design charter: Studio Ondé

Generated from design-system.json (Forge design system). Forge injects it into every AI call;
edit the design system rather than this file.

## Brand
Studio de design et motion à Dakar. Audacieux, joueur, sûr de lui.

## Colors
- `--bg`: #fff7ec
  - Page and slide background
- `--surface`: #ffffff
  - Cards, panels and inputs
- `--fg`: #141414
  - Main text
- `--muted`: #545454
  - Secondary text
- `--accent`: #d6246e
  - Brand accent: buttons, links, highlights
- `--border`: #141414
  - Hairlines, dividers and input borders
- `--accent-contrast`: #ffffff
  - Text and icons on the accent colour
- `--secondary`: #2f5bea
  - Secondary brand colour
- `--success`: #137a3f
  - Positive status
- `--warning`: #9a5b00
  - Warning status
- `--danger`: #b3261e
  - Errors and destructive actions
- `--info`: #2f5bea
  - Neutral information

Contrast (WCAG 2.2):
- fg on bg: 17.34 to 1 (AAA), body text
- fg on surface: 18.42 to 1 (AAA), text on cards
- muted on bg: 7.13 to 1 (AAA), secondary text
- muted on surface: 7.57 to 1 (AAA), secondary text on cards
- accent on bg: 4.56 to 1 (AA), accent elements and large text
- accent-contrast on accent: 4.84 to 1 (AA), button label
- success on bg: 5.09 to 1 (AA), status colour
- warning on bg: 5.11 to 1 (AA), status colour
- danger on bg: 6.15 to 1 (AA), status colour
- info on bg: 5.19 to 1 (AA), status colour

## Typography
- Display font: Syne
- Body font: DM Sans
- Mono font: Space Mono
- Google Fonts: https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap
- Load it as the FIRST line of src/index.css: @import url("https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap");
- Type scale: text-xs 12px, text-sm 13px, text-base 16px, text-lg 21px, text-xl 28px, text-2xl 38px, text-3xl 51px, text-4xl 67px, text-5xl 90px

## Spacing & radius
- space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 32px, space-2xl 48px, space-3xl 64px, radius-none 0px, radius-sm 0px, radius-md 4px, radius-lg 8px, radius-xl 12px, radius-full 9999px

## Motion
- motion-fast 100ms, motion-base 200ms, motion-slow 320ms, ease-standard cubic-bezier(0.3, 0, 0, 1)

## Iconography
- Library: lucide, style: outline
Traits épais, angles francs, comme dessinés au feutre.
- Do: Icônes grandes et noires
- Do: Flèches pour guider le regard
- Don't: Icônes fines et grises
- Don't: Emojis à la place des icônes

## Imagery
Projets en très grand, collages, grain de film, couleurs saturées.
- Do: Images à fond perdu
- Do: Recadrages audacieux
- Do: Mélange photo et formes graphiques
- Don't: Photos de bureau aseptisées
- Don't: Cadres arrondis sages

## Tone of voice
Affirmé et joueur. On montre plus qu'on n'explique.
- Do: Titres courts et percutants
- Do: Jeux de mots assumés
- Do: Première personne du pluriel
- Don't: Langue de bois d'agence
- Don't: Listes de buzzwords
- Don't: Ton neutre

## Logo
- File: /brand/logo.svg
- Clear space: Deux fois l'épaisseur du trait du O
- Minimum size: 40px
- Noir sur papier
- Blanc sur le rose
- Peut être recadré à fond perdu en très grand
- Don't: Le centrer timidement en petit
- Don't: Ombre portée douce
- Don't: Couleurs pastel

## Do / Don't
Contraste maximal, grille visible, une seule couleur vive à la fois.
- Do: Bordures noires de 2 px
- Do: Ombres dures décalées
- Do: Titres immenses
- Don't: Dégradés
- Don't: Coins très arrondis
- Don't: Plus d'une couleur vive par écran

## Components
- button, input, card, badge, alert, table

## CSS variables
```css
@import url("https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap");

:root {
  --bg: #fff7ec;
  --surface: #ffffff;
  --fg: #141414;
  --muted: #545454;
  --accent: #d6246e;
  --border: #141414;
  --accent-contrast: #ffffff;
  --secondary: #2f5bea;
  --success: #137a3f;
  --warning: #9a5b00;
  --danger: #b3261e;
  --info: #2f5bea;
  --font-display: Syne, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body: "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 16px;
  --text-lg: 21px;
  --text-xl: 28px;
  --text-2xl: 38px;
  --text-3xl: 51px;
  --text-4xl: 67px;
  --text-5xl: 90px;
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
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
  --shadow-sm: 2px 2px 0px 0px #141414ff;
  --shadow-md: 4px 4px 0px 0px #141414ff;
  --shadow-lg: 8px 8px 0px 0px #141414ff;
  --motion-fast: 100ms;
  --motion-base: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.3, 0, 0, 1);
  --icon-library: lucide;
  --icon-style: outline;
  --icon-stroke: 2.5px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --font-sans: "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
