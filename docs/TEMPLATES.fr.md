# Guide du contributeur de templates

> 🇬🇧 English version: [TEMPLATES.md](./TEMPLATES.md)

Forge propose une galerie de kits de démarrage forkables sous `data/templates/`. Ce guide décrit le contrat exact qu'un kit doit respecter — chaque règle ci-dessous est verrouillée par `apps/api/tests/test_templates.py`.

## Qu'est-ce qu'un kit ?

Un kit est un dossier `data/templates/<id>/` où `<id>` respecte la regex :

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Minuscules, chiffres et tirets, 2 à 63 caractères, commençant par une lettre ou un chiffre. Exemple : `aurora-ai`.

## Fichiers requis

```
data/templates/<id>/
├── template.json        # métadonnées du catalogue (voir plus bas)
├── DESIGN.md            # charte graphique (voir plus bas)
├── index.html
├── package.json         # "name" doit valoir <id>
├── preview.html         # vignette statique de la galerie
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/              # optionnel : images, manifest.webmanifest (kits mobiles)
└── src/
    ├── main.tsx         # createRoot nommé (voir les règles)
    ├── App.tsx          # composition uniquement
    ├── index.css        # fondation : tokens, reset, typo, shell, utilitaires partagés
    ├── components/      # un fichier par section / élément partagé
    ├── screens/         # kits mobiles : un fichier par écran
    └── styles/          # feuilles de page ou d'écran, scopées (home.css...)
```

Un kit est le premier code que l'agent modifie après un fork : il suit donc les mêmes règles que l'agent.

### `template.json`

Métadonnées bilingues plus une palette stricte. Les quatre couleurs doivent être en hex 6 chiffres (`#rrggbb`) :

```json
{
  "kind": "web",
  "id": "aurora-ai",
  "title": { "en": "Aurora AI", "fr": "Aurora AI" },
  "description": { "en": "…", "fr": "…" },
  "tags": ["ai", "saas", "landing", "dark"],
  "preview": "preview.html",
  "bootHint": { "en": "Adapt aurora-ai: …", "fr": "Adapte aurora-ai : …" },
  "accent": "#7c3aed",
  "bg": "#050208",
  "fg": "#f4f1fa",
  "muted": "#8b84a3",
  "tone": "visionary, sleek, quietly confident"
}
```

- `kind` : obligatoire — `"web"` (site / landing) ou `"mobile"` (prototype shell d’app). La galerie filtre sur ce champ ; le fork renseigne `project.platform`.
- `title`, `description`, `bootHint` : `en` et `fr` doivent être non vides.
- `accent`, `bg`, `fg`, `muted` : hex `#rrggbb` uniquement (pas de raccourci, pas de `rgb()`).
- `preview` pointe vers `"preview.html"`.
- `tone` : une ligne libre décrivant l'ambiance, réutilisée par l'IA lors de l'adaptation du kit.

### `DESIGN.md`

La charte de design que suit l'IA quand elle forke le kit. Sections requises :

```markdown
# Design charter

## Template
- id: <id>
- name: <Nom>

## Colors
- --bg: #050208
- --fg: #f4f1fa
- --muted: #8b84a3
- --accent: #7c3aed

## Typography
- Titres : pile system-ui, 700, clamp(2.4rem, 6vw, 4.2rem)
- Texte : pile system-ui, 400, 1rem / 1.6

## Spacing & radius
- Padding de section : clamp(4rem, 10vw, 7rem) ; rayon 14px

## Tone
Une ou deux phrases décrivant la voix et le style de copie.

## Do / Don't
- Do : garder les éléments visuels signatures…
- Don't : casser l'identité (thème, famille d'accent)…

## Images
- Usage : https://images.unsplash.com/photo-…?auto=format&fit=crop&w=1200&q=70 (courte légende)
```

La section `## Colors` doit lister les quatre mêmes variables que `template.json`.

## Règles dures (verrouillées par pytest)

`apps/api/app/services/template_contract.py` est le contrat sous forme de code ; `test_templates.py` l'applique à chaque kit.

1. **`src/main.tsx` utilise `import { createRoot } from "react-dom/client"`** (jamais l'import par défaut `ReactDOM`).
2. **Imports :** `react`, `react-dom/client` (main.tsx), `lucide-react` et fichiers locaux uniquement. Les kits tournent toujours sans installation.
3. **Les icônes sont des icônes `lucide-react`** (noms existant en 0.468.0). Pas d'emoji ni de glyphe utilisé comme icône, pas de SVG d'icône dessiné à la main.
4. **Fichiers séparés :** sections (web) ou écrans (mobile) dans `src/components/` / `src/screens/` ; `App.tsx` ne fait que les composer.
5. **Propriété du CSS :** `src/index.css` est la fondation (tokens, reset, typographie de base, shell, nav/footer ou shell d'app, boutons et éléments partagés). Les règles de section ou d'écran vivent dans `src/styles/<page>.css`, importé par le fichier qui les utilise et scopé sous une classe racine (`.home-screen .hero`).
6. **Mobile-first :** pas de `@media (max-width: …)` ; les règles de base sont la mise en page téléphone, les mises en page plus larges utilisent `min-width`.
7. **Pas d'`@import`** dans les feuilles de style (piles de polices système, animations CSS pures).
8. **`package.json` :** `lucide-react` en dependencies ; devDependencies alignées sur la chaîne d'export (`vite ^5.4.21`, `@vitejs/plugin-react ^4.3.4`, `typescript ^5.6.3`, `@types/react ^18.3.12`, `@types/react-dom ^18.3.1`).
9. **`DESIGN.md`** contient `## Colors` (les 4 variables de template.json), `## Typography` et `## Tone`.
10. **`preview.html` sans script**, avec pour seule origine externe `https://images.unsplash.com/`.
11. Un manifest vit dans `public/manifest.webmanifest`, jamais à la racine du kit.

## `preview.html` — la vignette de la galerie

`preview.html` est une mini-maquette statique autonome du hero du kit, rendue à environ **480×300** comme vignette de carte dans la galerie de modèles. Styles inline, poids minimal, réutiliser la palette du kit et reproduire la signature visuelle du hero (dégradés, layout, une image au plus).

## Checklist de validation locale

1. **Enregistrer l'id.** Ajouter votre `<id>` à `EXPECTED_IDS` dans `apps/api/tests/test_templates.py`.
2. **Lancer la suite templates :**

   ```sh
   cd apps/api && pytest tests/test_templates.py -q
   ```

3. **Vérifier la transformation Babel.** Les kits doivent compiler avec le même transform que le runner de preview. Vérification rapide avec un script Node de 6 lignes :

   ```js
   // check.mjs — à lancer depuis apps/api : node check.mjs
   import { readFileSync } from "node:fs";
   import { transform } from "./runtime/transform.mjs";
   const src = readFileSync("../../data/templates/<id>/src/App.tsx", "utf8");
   const out = transform(src, "src/App.tsx");
   if (out.error) { console.error(out.error); process.exit(1); }
   console.log("OK,", out.imports.map((i) => i.specifier));
   ```

4. **Tester visuellement.** Démarrer l'app, ouvrir l'onglet **Modèles** dans l'UI, vérifier la vignette, puis forker le kit et confirmer que la preview live s'affiche sans erreur.

## Conseils design

- **Prendre un parti pris fort.** Les kits à identité claire (brutalist, glassmorphism, éditorial mono…) s'adaptent mieux que les kits génériques.
- **Contenu réaliste.** Noms de produits crédibles, tiers de prix, témoignages — pas de lorem ipsum.
- **Photos Unsplash pertinentes.** Choisir des images qui collent à l'univers du kit ; documenter chaque URL dans `DESIGN.md § Images`.
- **Responsive.** Le kit doit tenir du mobile au desktop.
- **Animations CSS pures.** Mouvements keyframes subtils (dégradés dérivants, fondus, inclinaisons) — pas de librairie d'animation JS.
