> 🇬🇧 [English version](CONTRIBUTING.md)

# Contribuer à Forge

Merci de votre intérêt pour Forge. Ce projet suit des **règles de collaboration strictes** afin que chaque changement soit traçable, revu et sûr pour la production (`forge.rodiumai.io` / `api-forge.rodiumai.io`).

**Lisez ce document en entier avant d'ouvrir une issue ou une pull request.**

---

## Qui peut contribuer

Les contributions sont ouvertes aux profils ci-dessous. Restez dans votre périmètre ; les maintainers peuvent rediriger un travail qui relève d'une autre piste.

### Designers

Vous **pouvez** :

- Ouvrir des **issues** avec captures d'écran, maquettes ou exports Figma décrivant des améliorations UX/UI.
- Proposer des parcours, textes, mises en page et corrections d'accessibilité.
- Joindre des assets design (PNG, SVG, courtes vidéos d'écran) directement dans l'issue ou la PR.
- **Coder côté frontend** dans `apps/web` lorsque vous implémentez ou affinez l'interface (composants, styles, landing, builder).
- **Proposer ou co-créer des kits templates** dans `data/templates/` (starters de la galerie) — voir [Contribuer des kits templates](#contribuer-des-kits-templates) ci-dessous.

Vous **ne devez pas** :

- Modifier les contrats API, l'infrastructure ou le code sensible sécurité sans l'accord d'un maintainer backend.

**Modèles recommandés :** [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) · [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)

### Cybersécurité

**Testez sur votre stack locale, pas sur nos hôtes de production.**
`docker compose up` vous donne le système complet ; c'est la cible supportée
pour tout travail de sécurité. Nous n'opérons pas de bug bounty et n'accordons
aucune autorisation générale de tester `rodiumai.io` ou ses sous-domaines.

Vous **pouvez** :

- Auditer **votre propre déploiement local**, ainsi que tout site que vous avez publié vous-même.
- Relire le code de ce dépôt à la recherche de vulnérabilités — aucune autorisation nécessaire.
- Signaler les vulnérabilités confirmées via les **GitHub Security Advisories** (privé), ou par e-mail à **forge@rodiumai.io** — voir [SECURITY.fr.md](SECURITY.fr.md).
- Ouvrir une **issue publique** uniquement pour des idées de durcissement non sensibles (en-têtes, CSP, hygiène des dépendances), avec un **rapport écrit** et des **captures / preuves** si possible.

Vous **ne devez pas** :

- Tester nos environnements hébergés sans **autorisation écrite préalable**, que vous pouvez demander à forge@rodiumai.io. Un test non autorisé peut être illégal dans votre juridiction, quelle que soit votre intention.
- Mener des tests intrusifs (DoS, brute force, ingénierie sociale) — jamais dans le périmètre, même sur un hôte pour lequel vous avez été autorisé.
- Accéder, modifier ou conserver des données qui ne vous appartiennent pas, ni utiliser le compte d'un autre utilisateur.
- Divulguer publiquement des détails exploitables avant qu'un correctif soit publié.

Si vous signalez de bonne foi et restez dans le périmètre ci-dessus, nous
n'engagerons aucune poursuite à l'encontre de vos recherches.

### Développeurs frontend & backend

Vous **pouvez** :

- Implémenter des fonctionnalités, corriger des bugs, améliorer les prompts, l'orchestration, les templates et le runtime.
- Proposer des changements d'architecture via une issue **avant** les gros refactors.
- Toucher `apps/web`, `apps/api`, `apps/api/runtime` et `data/templates` selon le périmètre du changement.
- **Ajouter ou améliorer des kits templates** — voir [Contribuer des kits templates](#contribuer-des-kits-templates).

Vous **devez** :

- Ajouter ou mettre à jour les **tests** pour tout changement de comportement.
- Garder des PR **petites et ciblées** (un sujet par PR).

---

## Comment soumettre (obligatoire)

### 1. Rester à jour avec `main`

Avant de commencer **et à nouveau avant d'ouvrir ou de mettre à jour une PR** :

```bash
git fetch origin
git checkout main
git pull origin main
git checkout votre-branche
git rebase origin/main   # ou : git merge origin/main
```

**Les PR en retard sur `main` ou en conflit ne seront pas mergées** tant qu'elles ne sont pas rebasées et que la CI n'est pas verte.

### 2. Branche & commits

1. Forkez le dépôt (contributeurs externes) ou créez une branche depuis `main` (membres de l'org).
2. Nom de branche explicite : `feat/…`, `fix/…`, `design/…`, `security/…`, `template/…`.
3. Messages de commit au format `type(scope): résumé` (français ou anglais).

### 3. Exigences pull request (strict)

Chaque PR **doit** contenir :

| Exigence | Détail |
| --- | --- |
| **Résumé clair** | Ce qui change et **pourquoi** (pas seulement la liste des fichiers). |
| **Issues liées** | `Fixes #123` ou `Relates to #456` le cas échéant. |
| **Captures d'écran** | **Obligatoires** pour tout changement UI/UX (avant/après si pertinent). |
| **Vidéo démo** | **Fortement recommandée** pour les nouvelles fonctionnalités ou parcours non triviaux (30–90 s). |
| **Tests** | Commandes exécutées ; la CI doit passer (voir ci-dessous). |
| **Suivi des reviews** | **Répondre à chaque commentaire** de review dès que possible ; résoudre les fils ou expliquer pourquoi non. |

Les PR incomplètes (pas de visuels pour l'UI, pas de preuve de tests, fils de review sans réponse) **seront fermées ou renvoyées** jusqu'à correction.

Utilisez le [modèle de pull request](.github/PULL_REQUEST_TEMPLATE.md) — ne supprimez pas ses sections.

### 4. Review & merge

- Au moins une approbation maintainer requise.
- **Tous les jobs CI doivent être verts** (lint, tests, build, Gitleaks, Trivy, Semgrep).
- Merge par les maintainers après rebase sur le dernier `main`.

---

## Setup de développement

Lancez d'abord l'infra avec Docker :

```bash
cp .env.example .env
docker compose up -d --build   # ou : make up
```

### Frontend (`apps/web`)

Next.js 15 + TypeScript.

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3100
```

Vérifications avant soumission :

```bash
npm run typecheck
npm test
npm run lint
FORGE_FONT_MODE=fallback npm run build
```

### Backend (`apps/api`)

FastAPI + SQLAlchemy + Postgres.

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # ou source .venv/bin/activate
pip install -r requirements-dev.txt              # deps runtime + ruff + pytest
uvicorn app.main:app --reload --port 8100
```

Vérifications avant soumission :

```bash
ruff format app tests
ruff check app tests
pytest -q
```

Définissez `TEMPLATES_ROOT` pour les tests hors Docker :

```bash
export TEMPLATES_ROOT="$(pwd)/../../data/templates"   # depuis apps/api
```

### Runtime (`apps/api/runtime`)

Runner Babel navigateur. `packages.json` est la source unique de l'import map, de l'allowlist AST et des types Monaco.

```bash
cd apps/api/runtime
npm ci
node --test tests/
```

### Templates (`data/templates`)

Voir [Contribuer des kits templates](#contribuer-des-kits-templates).

---

## Contribuer des kits templates

Les kits templates sont des starters React forkables affichés dans la galerie Forge. **Designers et développeurs** peuvent en proposer de nouveaux ou améliorer les existants.

### Arborescence d'un kit

Chaque kit vit dans `data/templates/<id>/` où `<id>` respecte `^[a-z0-9][a-z0-9-]{1,62}$` (exemple : `aurora-ai`).

```
data/templates/<id>/
├── template.json        # catalogue : titre/description i18n, tags, palette hex, bootHint
├── DESIGN.md            # charte design (couleurs, ton, do/don't, URLs images)
├── preview.html         # vignette galerie statique — pas de balise <script>
├── index.html
├── package.json         # "name" doit valoir <id>
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx          # page unique — imports depuis "react" uniquement
    └── index.css        # CSS pur, pas de @import, variables :root palette
```

Vue d'ensemble : [data/templates/README.md](data/templates/README.md) · Contrat complet : [docs/TEMPLATES.fr.md](docs/TEMPLATES.fr.md) (🇬🇧 [TEMPLATES.md](docs/TEMPLATES.md))

### Règles clés (vérifiées en CI)

| Règle | Pourquoi |
| --- | --- |
| `src/App.tsx` n'importe que `"react"` | Les kits tournent dans le runner Babel navigateur sans install |
| `preview.html` sans `<script>` | Vignette galerie en HTML/CSS pur |
| `src/index.css` sans `@import` | Pas de polices/CSS externes au runtime |
| Palette `template.json` en hex `#rrggbb` | Tokens cohérents pour l'agent et la galerie |
| `title`, `description`, `bootHint` en **en** + **fr** | Produit bilingue |

### Workflow de soumission

1. Fork / branche depuis le dernier `main`.
2. Ajouter ou modifier `data/templates/<id>/` selon l'arborescence ci-dessus.
3. Enregistrer le nouvel `<id>` dans `EXPECTED_IDS` (`apps/api/tests/test_templates.py`).
4. Mettre à jour le routage par mots-clés dans `apps/api/app/services/templates.py` si le kit cible de nouveaux thèmes.
5. Lancer `cd apps/api && pytest tests/test_templates.py -q`.
6. Ouvrir une PR avec :
   - **Capture** de la carte galerie (rendu de `preview.html`)
   - **Capture ou vidéo** d'une preview live après fork dans le builder
   - Branche `template/<id>` pour un nouveau kit

Utilisez le modèle d'issue [template_proposal.yml](.github/ISSUE_TEMPLATE/template_proposal.yml) pour discuter d'un kit **avant** un gros travail design.

---

## Intégration continue

`.github/workflows/ci.yml` s'exécute à chaque push et pull request vers `main` :

| Job | Contrôle |
| --- | --- |
| **API** | Ruff format + lint, pytest |
| **Web** | ESLint, typecheck, Vitest, build production |
| **Runtime** | Parité manifest Python/JS |
| **Docker compose** | Validation stack locale |
| **Gitleaks** | Détection de secrets |
| **Trivy** | Vulnérabilités dépendances / images |
| **Semgrep** | Analyse statique (`apps/web`, `apps/api/app`) |

Corrigez les échecs CI sur votre branche avant de demander une review.

---

## Style de code

- **Python :** `ruff` (format + check)
- **TypeScript :** ESLint + `tsc`
- Suivre les conventions existantes ; pas de refactor hors sujet dans la PR.

---

## Où demander de l'aide

- **Questions & idées :** ouvrez une GitHub Issue avec l'un des modèles
- **Sécurité :** [SECURITY.fr.md](SECURITY.fr.md) — advisories privées, ou forge@rodiumai.io
- **Code de conduite :** [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md) — signalements en privé à forge@rodiumai.io
