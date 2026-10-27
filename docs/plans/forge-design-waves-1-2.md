# Forge Design : conventions des vagues 1 et 2

Brief commun à tous les agents. Lire d'abord `docs/plans/forge-design-plan.md` (le plan) puis ce fichier (les règles de partage). En cas de conflit, ce fichier gagne.

## Branches et intégration

- Branche d'intégration : `feat/forge-design` (vague 0 déjà dessus). Chaque agent travaille dans son propre worktree, sur sa propre branche partie de `feat/forge-design`, et commite localement. Pas de push, pas de PR, pas de merge : l'orchestrateur intègre.
- Ne jamais toucher `dev`, `main`, ni `D:\next js\RodiumAi\forge-web` (checkout de l'utilisateur).
- Ne modifier en dehors de son périmètre que le strict nécessaire, et le signaler dans le rapport (fichier, raison). Les contrats (`contracts/forge-design/*.schema.json`, `apps/api/app/contracts/forge_design.py`, `apps/web/lib/contracts/forge-design.ts`) ne changent que si c'est indispensable, avec fixtures et tests de parité mis à jour, et en le signalant.

## Emplacements réservés

| Zone | Propriétaire | Chemin |
|---|---|---|
| Lecteur de deck | A (vague 1) | `apps/web/components/deck-player/` |
| Éditeur de deck | B | `apps/web/components/deck-editor/`, route `apps/web/app/projects/[id]/deck/` |
| IA slides et routage des types document | C | `apps/api/app/services/deck_ai/`, prompts dans `apps/api/app/prompts/deck.py` |
| Exports et publication document | D | `apps/api/app/services/exports/`, `apps/api/runtime/deck/` (bundle lecteur publié, pptx) |
| Modèles de slides | E (6), F (30) | `data/templates/slides-<id>/` |
| Accueil Forge Design | J | `apps/web/components/home/`, `apps/web/app/dashboard/page.tsx` |
| Codelabs | G (vague 2) | `apps/web/components/codelab-*/`, `apps/api/app/services/codelab/` |
| Design system | H (vague 2) | `apps/web/components/design-system/`, `apps/api/app/services/design_system/` |
| Édition ciblée des sites | I (vague 2) | runtime Babel, `apply_writes.py`, `schemas.py SendMessageRequest` |

## Contrat du lecteur (A le livre, B, D et J le consomment)

```ts
// apps/web/components/deck-player/index.ts
export function SlideView(props: {
  slide: Slide; deck: Deck; tokens: ThemeTokens;   // types de lib/contracts/forge-design.ts
  scale?: number;            // calculé par le parent si absent : fit dans le conteneur
  step?: number;             // étape d'animation affichée (Infinity = tout visible)
  mode: "edit" | "present" | "print" | "thumbnail";
  assetUrl: (path: string) => string;   // résout "public/images/x.webp"
}): JSX.Element;

export function DeckPlayer(props: {
  deck: Deck; slides: Record<string, Slide>; notes?: Record<string, string>;
  tokens: ThemeTokens; assetUrl: (p: string) => string;
  startAt?: number; badge?: boolean;     // badge "Made with Forge"
  onSlideChange?: (index: number) => void;
}): JSX.Element;

export function themeTokensFromDesign(md: string): ThemeTokens;  // DESIGN.md ou design-system.json vers variables CSS
```

- Rendu en DOM absolu sur un canevas aux dimensions du format (1920x1080, 1440x1080, 1080x1080), mis à l'échelle par `transform: scale`.
- Le mode `print` affiche tout (pas d'animation) : il sert au PDF, PNG et PPTX (D lit les boîtes via Playwright).
- Sans dépendance au builder. Doit pouvoir être bundlé seul par D (esbuild) pour la page publiée et l'export HTML.

## API à disposition (vague 0)

- `GET/PUT /projects/{id}/deck`, `GET/PUT/PATCH /projects/{id}/slides/{sid}` (ETag, If-Match, 409 si périmé)
- `GET/PUT /projects/{id}/codelab`, `GET/PUT /projects/{id}/steps/{sid}`, `GET/PUT /projects/{id}/design-system`
- `GET /images/search`, `GET /images/models`, `POST /projects/{id}/images/import`, `POST /projects/{id}/images/generate`
- `GET /kinds` (registre, drapeaux)

## Règles

- Pas de tiret long (U+2014) nulle part : code, commentaires, docs, commits. Marque : "RodiumAi".
- Styles et densité de commentaires du code voisin. Interface en français et anglais via le système i18n existant du web.
- Tests : `cd apps/api && pytest -q` sur les zones touchées (venv `apps/api/.venv` de la vague 0 si présent dans le worktree, sinon le créer), `cd apps/web && npx tsc --noEmit && npx vitest run` sur les zones touchées. Rapporter honnêtement ce qui passe.
- Nouvelles dépendances seulement si nécessaires, licence MIT, Apache ou BSD, et listées dans le rapport.
- Commits petits et logiques, chacun se terminant par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rapport final : commits, fichiers, choix et écarts, tests, questions.

## Décisions après la vague 1 A (lecteur)

- **Groupes** : les coordonnées des enfants d'un `group` sont relatives au coin haut gauche du groupe. Valable pour l'éditeur, l'IA et les exports.
- **Lignes et flèches** : tracées horizontalement au milieu de leur boîte, l'angle vient de `rotation`, la pointe est à droite.
- **ThemeTokens** : `Record<string, string>` de `--nom` vers une valeur CSS ; `color.x` devient `--x`, les autres groupes `--groupe-x`, alias W3C `{a.b}` vers `var(...)`.
- **Icônes** : le bundle publié n'embarque que les icônes lucide utilisées par le deck (tree-shaking par liste générée), pas tout le jeu.
- **Vidéos** : la CSP du web autorise `https://www.youtube-nocookie.com` et `https://player.vimeo.com` en `frame-src` ; les pages publiées ont leur propre CSP avec les mêmes origines.
- **Crochets DOM pour les exports** : `data-deck-player`, `data-slide-id`, `data-element-id`, `data-element-type`, `data-step`.
- **API du lecteur** : voir `apps/web/components/deck-player/index.ts` (exports `SlideView`, `DeckPlayer`, `SlideCanvas`, `FittedSlide`, `PresenterView`, `themeTokensFromDesign`, `fitCanvas`, `stepCount`...). Page de démo : `/dev/deck-player` (hors production).
