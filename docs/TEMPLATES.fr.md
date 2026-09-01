# Guide du contributeur de templates

> 🇬🇧 English version: [TEMPLATES.md](./TEMPLATES.md)

Forge propose une galerie de kits de démarrage forkables sous `data/templates/`. Ce guide décrit le contrat exact qu'un kit doit respecter — chaque règle ci-dessous est verrouillée par `apps/api/tests/test_templates.py`.

## Qu'est-ce qu'un kit ?

Un kit est un dossier `data/templates/<id>/` où `<id>` respecte la regex :

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Minuscules, chiffres et tirets, 2 à 63 caractères, commençant par une lettre ou un chiffre. Exemple : `aurora-ai`.

## Fichiers requis (12)

```
data/templates/<id>/
├── template.json        # métadonnées catalogue (voir ci-dessous)
├── DESIGN.md            # charte de design (voir ci-dessous)
├── index.html
├── package.json         # "name" doit valoir <id>
├── preview.html         # vignette statique de la galerie
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    └── index.css
```

### `template.json`

Métadonnées bilingues plus une palette stricte. Les quatre couleurs doivent être en hex 6 chiffres (`#rrggbb`) :

```json
{
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

1. **`src/App.tsx` n'importe QUE depuis `"react"`.** Les kits tournent dans le runner Babel sans installation : pas de routeur, pas de librairie UI, pas de pack d'icônes. Tout spécificateur `from "…"` autre que `react` fait échouer la suite.
2. **`preview.html` sans script.** Aucune balise `<script>`, quelle que soit la casse.
3. **`preview.html` ne peut référencer qu'une seule origine externe :** `https://images.unsplash.com/`. Toute autre URL `http(s)://` fait échouer la suite.
4. **`src/index.css` est autonome.** Pas de `@import` — pas de Google Fonts, pas de CSS externe. Utiliser des piles de polices système et des animations CSS pures.

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
