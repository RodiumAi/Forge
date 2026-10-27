# Guide du contributeur de kits de départ

> 🇬🇧 English version: [TEMPLATES.md](./TEMPLATES.md)

Forge propose une galerie de kits de départ forkables sous `data/templates/`.
Ce guide est le contrat de création pour chaque type de projet. Le chargeur est
`apps/api/app/services/templates.py` ; les règles ci-dessous sont vérifiées par
les tests de templates de `apps/api/tests/`.

## Le catalogue

`data/templates/` contient 86 kits :

| Type (`kind` de `template.json`) | Kits | Préfixe d'id | Tests du contrat |
|---|---|---|---|
| `web` (site) | 24 | aucun | `test_templates.py` |
| `mobile` (application) | 12 | aucun | `test_templates.py` |
| `slides` | 36 | `slides-` | `test_templates.py`, `test_template_slides.py` |
| `codelab` | 8 | `codelab-` | `test_templates.py`, `test_template_codelab.py` |
| `design_system` | 6 | `design-system-` | `test_templates.py`, `test_template_design_systems.py` |

`test_template_gating.py` vérifie les champs de restriction par plan. Les kits
slides, codelab et design system n'apparaissent dans le catalogue public que si
leur type est activé (`FORGE_KIND_SLIDES_ENABLED`, `FORGE_KIND_CODELAB_ENABLED`,
`FORGE_KIND_DESIGN_SYSTEM_ENABLED`, tous désactivés par défaut).

## Règles communes à tous les types

### Dossier et id

Un kit est un dossier `data/templates/<id>/` où `<id>` respecte :

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Minuscules, chiffres et tirets, 2 à 63 caractères, commençant par une lettre ou
un chiffre. Les dossiers dont le nom commence par `_` sont ignorés.

Le chargeur ne liste un kit que si `template.json` se lit et si les fichiers
minimaux de son type existent :

| Type | Fichiers minimaux |
|---|---|
| `web`, `mobile` | `package.json`, `src/App.tsx` |
| `slides` | `deck.json`, un dossier `slides/` |
| `codelab` | `codelab.json`, un dossier `steps/` |
| `design_system` | `design-system.json` |

Un `kind` absent ou inconnu est lu comme `web`.

### `template.json`

Métadonnées du catalogue, bilingues, avec une palette stricte. Champs communs à
tous les types :

| Champ | Règle |
|---|---|
| `kind` | `web`, `mobile`, `slides`, `codelab` ou `design_system` (testé) |
| `id` | le nom du dossier |
| `title` | `{ "en": "…", "fr": "…" }`, les deux non vides (testé) |
| `description` | `{ "en": "…", "fr": "…" }`, les deux non vides (testé) |
| `accent`, `bg`, `fg`, `muted` | `#rrggbb` uniquement, sans raccourci ni `rgb()` (testé) |
| `bootHint` | `{ "en": "…", "fr": "…" }` : ce qu'il faut adapter en premier après un fork |
| `tags` | liste de mots courts, utilisée par la recherche de la galerie |
| `preview` | `"preview.html"` |
| `tone` | une courte ligne libre d'ambiance, réutilisée par l'IA pour adapter le kit |
| `fonts` | `{ "display", "body", "mono" }` : présent dans tous les kits slides, codelab, design system et mobile |
| `free` | optionnel ; `true` rend le kit utilisable sur le plan Free (voir les restrictions) |

Tous les kits du dépôt renseignent tous ces champs sauf `free`. Les champs
propres à chaque type sont listés dans les sections suivantes.

### Images de la galerie

- `preview.html` est une mini-maquette statique : **aucun `<script>`**, styles
  inline, et aucune URL distante autre que `https://images.unsplash.com/` et
  Google Fonts (kits slides : aucune URL distante).
- `preview.png` est la carte de la galerie : les 480 x 270 du haut de
  `preview.html`, rendus en 2x par `apps/api/scripts/render_template_previews.py`
  (`python scripts/render_template_previews.py <id>` depuis `apps/api`,
  nécessite Playwright). Committez-le à côté de `preview.html`. Les kits design
  system y sont ignorés : `apps/api/scripts/design_system_kits/build_kits.py`
  dessine leur carte.

### Ce que fait un fork

`fork_template` copie le kit dans le nouveau projet, puis :

- retire `template.json` et `preview.png`, et écrit `.forge/template.json` (id,
  type, ton, indice de départ) pour que l'agent sache d'où vient le projet ;
- remplace les tirets longs dans les fichiers texte copiés ;
- selon le type : sites et applications reçoivent le nom du projet dans
  `package.json` et `index.html` et un favicon par défaut ; les documents slides,
  codelab et design system sont validés contre `contracts/forge-design/` et
  prennent le nom du projet (un nom générique comme « Nouveau projet » garde le
  titre de la présentation) ;
- prend un premier point d'historique.

### Restrictions par plan (Forge Cloud uniquement)

`apps/api/app/services/template_gating.py`. Les installations open source et
BYOK ne sont pas restreintes. Sur Forge Cloud, un kit avec `"free": true` peut
démarrer un projet sur le plan Free, tous les autres kits démarrent à Starter,
et les kits design system suivent la règle des design systems (Builder). Les
aperçus et le détail des kits restent publics. `test_template_gating.py` attend
exactement deux kits gratuits par type (web, mobile, slides, codelab) et aucun
pour les design systems : modifiez ce test si vous changez la répartition.

## Sites et applications (`kind: "web"` et `"mobile"`)

### Fichiers requis

```
data/templates/<id>/
├── template.json        # métadonnées du catalogue
├── DESIGN.md            # charte graphique
├── index.html
├── package.json         # nom, dépendances, chaîne d'outils épinglée
├── preview.html         # maquette statique de la galerie
├── preview.png          # carte de la galerie
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/              # optionnel : images ; kits mobiles : manifest.webmanifest, icon.svg
└── src/
    ├── main.tsx         # createRoot nommé (voir les règles)
    ├── App.tsx          # composition uniquement
    ├── index.css        # fondation : tokens, reset, typo, shell, utilitaires partagés
    ├── components/      # un fichier par section / élément partagé
    ├── screens/         # kits mobiles : un fichier par écran (<Nom>Screen.tsx)
    └── styles/          # feuilles de page ou d'écran, scopées (home.css...)
```

Un kit est le premier code que l'agent modifie après un fork : il suit donc les
mêmes règles que l'agent. Exemple de `template.json` :

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

Le fork renseigne `project.platform` à partir de `kind`.

### `DESIGN.md`

La charte graphique que suit l'IA quand elle adapte le kit :

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

`## Colors` liste les quatre mêmes variables que `template.json`.

### Règles dures

`apps/api/app/services/template_contract.py` est le contrat sous forme de code ;
`test_templates.py` l'applique à chaque kit de site et d'application.

1. **`src/main.tsx` utilise `import { createRoot } from "react-dom/client"`** (jamais l'import par défaut `ReactDOM`).
2. **Imports :** `react`, `react-dom/client`, `react-router-dom` (les pages et écrans d'app sont des routes), `lucide-react` et fichiers locaux uniquement.
3. **Les icônes sont des icônes `lucide-react`** dont le nom existe dans `apps/api/runtime/lucide_exports.json`. Pas d'emoji ni de glyphe utilisé comme icône.
4. **Fichiers séparés :** au moins trois fichiers source hors de la racine de `src/` (sections dans `src/components/`, écrans dans `src/screens/`) ; `App.tsx` ne fait que les composer.
5. **Propriété du CSS :** `src/index.css` est la fondation (tokens, reset, typographie de base, shell, nav/footer ou shell d'app, boutons et éléments partagés). Les règles de section ou d'écran vivent dans `src/styles/<page>.css`, importé par le fichier qui les utilise et scopé sous une classe racine (`.home-screen .hero`). Chaque feuille de `src/styles/` doit être importée.
6. **Mobile-first :** pas de `@media (max-width: …)` ; les règles de base sont la mise en page téléphone, les mises en page plus larges utilisent `min-width`.
7. **Un seul `@import` au plus :** la ligne Google Fonts donnée par `DESIGN.md`, en toute première ligne de `src/index.css`. Aucun autre `@import`.
8. **`package.json` :** `lucide-react` en dependencies ; devDependencies alignées sur la chaîne d'export (`vite ^5.4.21`, `@vitejs/plugin-react ^4.3.4`, `typescript ^5.6.3`, `@types/react ^18.3.12`, `@types/react-dom ^18.3.1`).
9. **`DESIGN.md`** contient `## Colors`, `## Typography` et `## Tone`.
10. **`README.md`** existe.
11. Un manifest vit dans `public/manifest.webmanifest`, jamais à la racine du kit.

### `preview.html` des sites et applications

Les kits web reproduisent la signature visuelle du hero (dégradés, layout, une
image au plus). Les kits mobiles montrent deux ou trois téléphones avec de vrais
écrans sur un fond aux couleurs du kit ; ne jamais nommer une classe `phone`
(une ancienne règle de la galerie cible `.phone {` et la recadre).

### Conseils design

- **Prendre un parti pris fort.** Les kits à identité claire (brutalist, glassmorphism, éditorial mono…) s'adaptent mieux que les kits génériques.
- **Contenu réaliste.** Noms de produits crédibles, niveaux de prix, témoignages ; pas de lorem ipsum.
- **Photos Unsplash pertinentes.** Choisir des images qui collent à l'univers du kit ; documenter chaque URL dans `DESIGN.md § Images`.
- **Responsive.** Le kit doit tenir du mobile au desktop.
- **Animations CSS pures.** Mouvements keyframes subtils (dégradés dérivants, fondus, inclinaisons) ; pas de librairie d'animation JS.

## Présentations (`kind: "slides"`)

Les kits de présentation sont des documents rendus par le lecteur de
présentations Forge, pas du code React. Ni `package.json`, ni `src/`.

```
data/templates/slides-<nom>/
├── template.json      # + category, fonts, transitionPreset, layouts
├── DESIGN.md          # tokens du thème, lignes de polices, mises en page, transitions, images, ton
├── deck.json          # contracts/forge-design/deck.schema.json
├── slides/s1.json …   # un fichier par slide, slide.schema.json
├── notes/s1.md …      # un fichier de notes d'orateur par slide
├── public/images/     # images WebP
├── preview.html       # statique, sans URL distante (images data: inline autorisées)
└── preview.png
```

Champs supplémentaires de `template.json` :

| Champ | Règle |
|---|---|
| `category` | parmi `business`, `marketing`, `education`, `tech`, `creative`, `minimal` |
| `fonts` | `display`, `body`, `mono`, chacune dans la liste `GOOGLE_FONTS` de `apps/api/app/services/brand_charter.py` |
| `transitionPreset` | `sober`, `dynamic` ou `elegant` |
| `layouts` | associe chacune des 12 mises en page obligatoires à sa slide d'exemple : `{ "title": "s1", "section": "s2", … }` |

Ce que vérifie `test_template_slides.py` :

- l'id commence par `slides-` ; `template.json`, `DESIGN.md`, `deck.json` et
  `preview.html` existent ; pas de `package.json` ;
- `deck.json` et chaque slide sont valides contre le contrat ; 8 à 12 slides ;
  les fichiers de slides et `deck.json` listent les mêmes ids ; chaque slide a
  son `notes/<id>.md` ;
- les 12 mises en page de `SLIDES_LAYOUTS` (`title`, `section`, `text`,
  `two-columns`, `image-text`, `quote`, `key-numbers`, `chart`, `table`, `team`,
  `timeline`, `thanks`) sont toutes utilisées, et `layouts` associe chacune à
  une slide de cette mise en page ;
- les images sont des `public/images/*.webp` existants, avec un `credit`
  portant `source` et `author` (images de fond comprises) ; les icônes sont des
  noms lucide ;
- `DESIGN.md` définit au moins `--bg`, `--surface`, `--fg`, `--muted`,
  `--accent` et `--border` sous forme de lignes `` - `--token`: #rrggbb ``, les
  slides n'utilisent aucun autre token, et il contient les lignes
  `Display font:`, `Body font:` et `Mono font:` tirées de la liste ;
- le kit complet pèse moins de 3 Mo, `preview.html` n'a ni script ni URL
  distante, et aucun fichier `.json`, `.md` ou `.html` ne contient de tiret long.

Géométrie des mises en page, tokens du thème, préréglages de transition, les 36
kits, règles d'images et de rédaction :
[templates/slides-style-guide.md](./templates/slides-style-guide.md) (en
anglais). Sources sous licence :
[templates/slides-sources.md](./templates/slides-sources.md). Les scripts qui
ont construit les kits slides sont dans `apps/api/scripts/slides_kits/`.

## Codelabs (`kind: "codelab"`)

Les kits codelab sont des documents rendus par le lecteur de codelabs Forge.
Pas de `package.json`.

```
data/templates/codelab-<nom>/
├── template.json      # + category, fonts
├── DESIGN.md          # tokens du thème et lignes de polices
├── codelab.json       # contracts/forge-design/codelab.schema.json
├── steps/01-intro.md …  # un fichier Markdown étendu par étape
├── files/starter/ …   # fichiers téléchargeables (en général départ et solution)
├── files/solution/ …
├── preview.html
└── preview.png
```

Champs supplémentaires de `template.json` : `category` (les kits utilisent
`backend`, `frontend`, `mobile`, `data`, `devops`, `education`, `ai`) et
`fonts`.

`codelab.json` contient `version`, `title`, `summary`, `level` (`beginner`,
`intermediate`, `advanced`), `durationMinutes`, `prerequisites`, `learn`,
`author`, `theme` (`{ "designSystem": "local", "tokens": "DESIGN.md" }` dans les
kits), `steps` (`id`, `title`, `file`, `minutes`) et `downloads` (`id`,
`label`, `path`, `zip`). Voir `codelab-rest-api` pour un exemple complet.

Ce que vérifie `test_template_codelab.py` :

- l'id commence par `codelab-` ; `template.json`, `DESIGN.md`, `codelab.json` et
  `preview.html` existent ; pas de `package.json` ;
- `codelab.json` est valide contre le contrat ; 5 à 12 étapes ; les fichiers
  d'étapes listés sont exactement les fichiers `steps/*.md` ; `durationMinutes`
  est la somme des minutes des étapes ; `summary`, `learn` et `prerequisites`
  ne sont pas vides ;
- chaque téléchargement déclaré existe (un téléchargement `zip: true` est un
  dossier non vide) ; les fichiers de `files/` ont des chemins normalisés et
  aucune extension bloquée (la politique de téléversement de
  `app/services/codelab/files.py`) ;
- chaque étape commence par `# `, a des blocs de code équilibrés, n'utilise que
  les conteneurs `:::` connus (`tabs`, `info`, `note`, `tip`, `success`,
  `warning`, `caution`, `danger`, `error`) et les ferme, fait pointer les blocs
  ```` ```download ```` et les liens `download="…"` vers des téléchargements
  déclarés ou des fichiers existants, et ne contient pas de HTML brut hors du
  code ;
- le kit pèse au plus 512 Ko (`preview.png` exclu), sans tiret long ;
  `title.fr` et `description.fr` sont renseignés ;
- `DESIGN.md` nomme `--bg`, `--fg`, `--accent`, `--surface`, `--border` et
  `--muted` et contient une ligne `Mono font:`.

Un kit dont `codelab.json` liste un fichier d'étape absent fait échouer le
fork. Le contenu d'exemple des kits est en français.

## Design systems (`kind: "design_system"`)

```
data/templates/design-system-<nom>/
├── template.json        # + fonts
├── design-system.json   # contracts/forge-design/design-system.schema.json
├── DESIGN.md            # généré depuis design-system.json
├── public/brand/        # logo.svg, logo-dark.svg, icon.svg
├── preview.html         # la page de charte de marque, assets inline
└── preview.png          # la carte de la galerie
```

N'écrivez pas ces kits à la main :
`apps/api/scripts/design_system_kits/build_kits.py` (lancé depuis `apps/api`)
construit chaque fichier à partir d'une spécification compacte avec le même
code que l'IA (`tokens.build_document`), si bien qu'un kit est toujours un design
system valide au contraste vérifié. Les marques viennent de
`scripts/design_system_kits/brands/<id>/`.

Ce que vérifie `test_template_design_systems.py` : `design-system.json` est
valide, chaque paire de contraste passe, le fichier de logo qu'il nomme existe,
`preview.html` et `DESIGN.md` existent, et aucun fichier `.json`, `.md`, `.html`
ou `.svg` ne contient de tiret long. Au fork, le design system prend le nom du
projet, un logo wordmark généré (`public/brand/logo.svg`) est redessiné avec ce
nom, `DESIGN.md` est régénéré et `preview.html` est retiré.

## Tester un nouveau kit en local

Préparez l'API comme décrit dans [CONTRIBUTING.fr.md](../CONTRIBUTING.fr.md)
(environnement virtuel, `npm ci` dans `apps/api/runtime` et
`apps/api/runtime/deck`, `TEMPLATES_ROOT` hors Docker). Puis :

1. **Enregistrer l'id** dans `apps/api/tests/test_templates.py` : l'ensemble de
   son type (`EXPECTED_SLIDES_IDS`, `EXPECTED_CODELAB_IDS`,
   `EXPECTED_DESIGN_SYSTEM_IDS`, `EXPECTED_MOBILE_IDS`) ou les ids web dans
   `EXPECTED_IDS`. `test_all_kits_are_listed` échoue tant que ce n'est pas fait,
   et aussi quand le chargeur ignore votre kit.
2. **Lancer les suites de votre type :**

   ```sh
   cd apps/api
   pytest tests/test_templates.py tests/test_template_gating.py -q
   pytest tests/test_template_slides.py -q          # présentations
   pytest tests/test_template_codelab.py -q         # codelabs
   pytest tests/test_template_design_systems.py -q  # design systems
   ```

3. **Sites et applications : vérifier la transformation Babel.** Les kits
   doivent compiler avec le même transform que le runner de preview :

   ```js
   // check.mjs, à lancer depuis apps/api : node check.mjs
   import { readFileSync } from "node:fs";
   import { transform } from "./runtime/transform.mjs";
   const src = readFileSync("../../data/templates/<id>/src/App.tsx", "utf8");
   const out = transform(src, "src/App.tsx");
   if (out.error) { console.error(out.error); process.exit(1); }
   console.log("OK,", out.imports.map((i) => i.specifier));
   ```

4. **Rendre la carte de la galerie** avec
   `python scripts/render_template_previews.py <id>` (depuis `apps/api` ;
   design systems : `build_kits.py`).
5. **Tester visuellement.** Démarrer la stack, activer le drapeau de votre type
   s'il s'agit d'un type document, ouvrir la galerie de templates
   (`/templates`), vérifier la carte, forker le kit et confirmer que l'éditeur
   ou la preview live s'ouvre sans erreur.
