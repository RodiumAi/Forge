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
- **Coder côté frontend** dans `apps/web` lorsque vous implémentez ou affinez l'interface (composants, styles, landing, éditeurs).
- **Proposer ou co-créer des kits templates** dans `data/templates/` (sites, applis, slides, codelabs, design systems). Voir [Contribuer des kits templates](#contribuer-des-kits-templates).
- **Proposer ou co-créer des intégrations** dans `data/integrations/` (catalogue d'embeds). Voir [Contribuer des intégrations](#contribuer-des-intégrations).

Vous **ne devez pas** :

- Modifier les contrats API, l'infrastructure ou le code sensible sécurité sans l'accord d'un maintainer backend.

**Modèles recommandés :** [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) · [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml) · [Template proposal](.github/ISSUE_TEMPLATE/template_proposal.yml)

### Cybersécurité

**Testez sur votre stack locale, pas sur nos hôtes de production.**
`docker compose up` vous donne le système complet ; c'est la cible supportée
pour tout travail de sécurité. Nous n'opérons pas de bug bounty et n'accordons
aucune autorisation générale de tester `rodiumai.io` ou ses sous-domaines.

Vous **pouvez** :

- Auditer **votre propre déploiement local**, ainsi que tout site que vous avez publié vous-même.
- Relire le code de ce dépôt à la recherche de vulnérabilités (aucune autorisation nécessaire).
- Signaler les vulnérabilités confirmées via les **GitHub Security Advisories** (privé), ou par e-mail à **forge@rodiumai.io**. Voir [SECURITY.fr.md](SECURITY.fr.md).
- Ouvrir une **issue publique** uniquement pour des idées de durcissement non sensibles (en-têtes, CSP, hygiène des dépendances), avec un **rapport écrit** et des **captures / preuves** si possible.

Vous **ne devez pas** :

- Tester nos environnements hébergés sans **autorisation écrite préalable**, que vous pouvez demander à forge@rodiumai.io. Un test non autorisé peut être illégal dans votre juridiction, quelle que soit votre intention.
- Mener des tests intrusifs (DoS, brute force, ingénierie sociale). Ils ne sont jamais dans le périmètre, même sur un hôte pour lequel vous avez été autorisé.
- Accéder, modifier ou conserver des données qui ne vous appartiennent pas, ni utiliser le compte d'un autre utilisateur.
- Divulguer publiquement des détails exploitables avant qu'un correctif soit publié.

Si vous signalez de bonne foi et restez dans le périmètre ci-dessus, nous
n'engagerons aucune poursuite à l'encontre de vos recherches.

### Développeurs frontend & backend

Vous **pouvez** :

- Implémenter des fonctionnalités, corriger des bugs, améliorer les prompts, l'orchestration, les éditeurs, les templates et le runtime.
- Proposer des changements d'architecture via une issue **avant** les gros refactors.
- Toucher `apps/web`, `apps/api`, `apps/api/runtime`, `contracts/`, `data/templates` et `data/integrations` selon le périmètre du changement.
- **Ajouter ou améliorer des kits templates**. Voir [Contribuer des kits templates](#contribuer-des-kits-templates).
- **Ajouter ou améliorer des intégrations**. Voir [Contribuer des intégrations](#contribuer-des-intégrations).

Vous **devez** :

- Ajouter ou mettre à jour les **tests** pour tout changement de comportement.
- Garder des PR **petites et ciblées** (un sujet par PR).

---

## Branches

| Branche | Rôle |
| --- | --- |
| `dev` | Branche d'intégration. **Toutes les pull requests visent `dev`.** |
| `main` | Branche de release. Les maintainers fusionnent `dev` dans `main` par une PR de release ; un merge sur `main` déploie la production. |

N'ouvrez pas de PR de fonctionnalité ou de correctif vers `main`.

## Comment soumettre (obligatoire)

### 1. Rester à jour avec `dev`

Avant de commencer **et à nouveau avant d'ouvrir ou de mettre à jour une PR** :

```bash
git fetch origin
git checkout votre-branche
git rebase origin/dev   # ou : git merge origin/dev
```

**Les PR en retard sur `dev` ou en conflit avec elle ne seront pas mergées** tant qu'elles ne sont pas rebasées et que les vérifications ne passent pas.

### 2. Branche & commits

1. Forkez le dépôt (contributeurs externes) ou créez une branche depuis `dev` (membres de l'org).
2. Nom de branche explicite : `feat/…`, `fix/…`, `design/…`, `security/…`, `template/…`, `integration/…`.
3. Messages de commit au format `type(scope): résumé` (français ou anglais).

### 3. Exigences pull request (strict)

Chaque PR **doit** contenir :

| Exigence | Détail |
| --- | --- |
| **Résumé clair** | Ce qui change et **pourquoi** (pas seulement la liste des fichiers). |
| **Type de projet** | Le type concerné : site / appli, slides, codelab, design system, ou aucun en particulier. |
| **Issues liées** | `Fixes #123` ou `Relates to #456` le cas échéant. |
| **Captures d'écran** | **Obligatoires** pour tout changement UI/UX (avant/après si pertinent). |
| **Vidéo démo** | **Fortement recommandée** pour les nouvelles fonctionnalités ou les parcours non triviaux (une courte vidéo d'écran, de 30 à 90 secondes). |
| **Tests** | Les commandes lancées (voir [Vérifications (CI)](#vérifications-ci)). |
| **Suivi des reviews** | **Répondre à chaque commentaire** de review dès que possible ; résoudre les fils ou expliquer pourquoi non. |

Les PR incomplètes (pas de visuels pour l'UI, pas de preuve de tests, fils de review sans réponse) **seront fermées ou renvoyées** jusqu'à correction.

Utilisez le [modèle de pull request](.github/PULL_REQUEST_TEMPLATE.md) et gardez toutes ses sections.

### 4. Review & merge

- Au moins une approbation maintainer est requise.
- Les vérifications de [Vérifications (CI)](#vérifications-ci) doivent passer.
- Les maintainers mergent dans `dev` après un rebase sur le dernier `dev`.

---

## Où vit le code

Forge produit cinq types de projets. Les sites et applis sont des projets React édités dans le builder ; les slides, codelabs et design systems sont des documents, chacun avec son éditeur et son lecteur.

| Type | Id `kind` | Web (`apps/web`) | API (`apps/api`) | Templates |
| --- | --- | --- | --- | --- |
| Site | `web` | `components/builder/` | `app/services/orchestration/`, `app/services/scaffold.py`, `runtime/` | `data/templates/<id>/` |
| Appli (mobile) | `mobile` | `components/builder/` | comme les sites | `data/templates/<id>/` |
| Slides | `slides` | `components/deck-editor/`, `components/deck-player/`, `components/deck-exports/` | `app/services/deck_ai/`, `app/services/exports/`, `runtime/deck/` (bundle du lecteur, PPTX) | `data/templates/slides-*/` |
| Codelab | `codelab` | `components/codelab-editor/`, `components/codelab-player/` | `app/services/codelab/`, `runtime/codelab/` (bundle du lecteur) | `data/templates/codelab-*/` |
| Design system | `design_system` | `components/design-system/` | `app/services/design_system/` | `data/templates/design-system-*/` |

Éléments partagés :

- `apps/api/app/kinds/` : le registre des types (éditeur, exports, publication et flag de chaque type). `apps/web/lib/kinds.ts` en est le miroir.
- `contracts/forge-design/` : les schémas JSON des documents deck, slide, codelab et design system.
- `apps/api/runtime/` : le runner Babel navigateur des sites et applis. `packages.json` est la source unique de l'import map, de l'allowlist AST et des types Monaco.
- `apps/api/app/db.py` : le schéma de la base. Il n'y a pas de fichiers de migration : l'API applique un DDL idempotent au démarrage.
- `data/integrations/` : le catalogue d'embeds affiché sur `/integrations`.

---

## Setup de développement

La CI utilise **Python 3.12** et **Node 22**. Prenez les mêmes versions en local.

Lancez d'abord la stack avec Docker :

```bash
cp .env.example .env
docker compose up -d --build   # ou : make up
```

`make up` applique aussi le schéma et affiche les URLs locales (UI sur http://localhost:3100, docs de l'API sur http://localhost:8100/docs). Voir [DOCKER.fr.md](DOCKER.fr.md) pour la stack locale complète.

### Activer slides, codelabs et design systems

Les sites et applis sont toujours actifs. Les trois types documents sont **désactivés** par défaut. Pour travailler dessus, activez-les côté API :

```bash
FORGE_KIND_SLIDES_ENABLED=true
FORGE_KIND_CODELAB_ENABLED=true
FORGE_KIND_DESIGN_SYSTEM_ENABLED=true
```

- Avec Docker, ajoutez-les au `.env` racine, puis recréez le conteneur API : `docker compose up -d --force-recreate api`.
- Avec l'API sur l'hôte, ajoutez-les à `apps/api/.env` et relancez uvicorn.

Le web n'a besoin d'aucun flag : il demande à l'API quels types sont actifs (`GET /kinds`).

Optionnel : `PIXABAY_API_KEY` (côté serveur uniquement) active la recherche d'images gratuites du panneau image. Vide, cette recherche répond 503 et le reste du panneau fonctionne.

### Frontend (`apps/web`)

Next.js 15 + TypeScript.

```bash
cd apps/web
npm ci
npm run dev   # http://localhost:3100
```

### Backend (`apps/api`)

FastAPI + SQLAlchemy + Postgres.

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # ou : source .venv/bin/activate
pip install --require-hashes -r requirements-dev.txt   # deps runtime + ruff + pytest
uvicorn app.main:app --reload --port 8100
```

Modifiez `requirements.in` ou `requirements-dev.in`, puis lancez `make lock`
depuis la racine du dépôt. Commitez l'entrée et le lock compilé ; ne modifiez
pas à la main les fichiers `.txt` générés. La CI échoue si un lock ne correspond
pas à son entrée.

Certains tests de l'API lancent les runtimes Node. Installez-les une fois avant pytest :

```bash
cd apps/api/runtime && npm ci
cd deck && npm ci
```

Définissez `TEMPLATES_ROOT` / `INTEGRATIONS_ROOT` pour les tests hors Docker (la CI définit les deux) :

```bash
export TEMPLATES_ROOT="$(pwd)/../../data/templates"   # depuis apps/api
export INTEGRATIONS_ROOT="$(pwd)/../../data/integrations"
```

Depuis la racine du dépôt, `make test` lance `pytest -q` sur l'hôte avec `TEMPLATES_ROOT` défini.

### Lecteur de codelab (API sur l'hôte)

L'image Docker de l'API construit elle-même le lecteur de codelab. Avec l'API sur l'hôte, construisez-le une fois avant de publier ou d'exporter un codelab :

```bash
cd apps/web
npm run build:codelab-player   # sortie : apps/api/runtime/codelab/dist
```

---

## Vérifications (CI)

`.github/workflows/ci.yml` s'exécute à chaque push sur `dev` et `main`, et sur les pull requests vers `main`. Elle ne s'exécute **pas** sur les pull requests vers `dev` : **lancez les vérifications ci-dessous en local** avant d'ouvrir ou de mettre à jour une PR, et listez-les dans la PR.

| Job | Ce qu'il lance | En local |
| --- | --- | --- |
| **API** | Contrôle des locks, `pip check`, lint et format Ruff, import de l'app, pytest (contrats templates et intégrations inclus) | voir ci-dessous |
| **Web** | ESLint, TypeScript, Vitest, build de production | voir ci-dessous |
| **Runtime manifest** | Tests du runtime, tests du runtime deck, parité import map / allowlist AST | voir ci-dessous |
| **Docker compose** | `docker compose config --quiet` sur une copie de `.env.example` | `cp .env.example .env && docker compose config --quiet` |
| **Gitleaks** | Détection de secrets sur tout l'historique (`.gitleaks.toml`) | optionnel, image Docker `ghcr.io/gitleaks/gitleaks` |
| **Trivy** | Scan du dépôt, vulnérabilités CRITICAL et HIGH qui ont un correctif | optionnel, image Docker `aquasec/trivy` |
| **Semgrep** | SAST sur `apps/web` (avec `.semgrep/rules/rodiumai-frontend.yml`) et sur `apps/api/app` | optionnel, image Docker `semgrep/semgrep` |

API (depuis `apps/api`, après installation des runtimes ci-dessus) :

```bash
ruff check app tests
ruff format --check app tests
ENVIRONMENT=test python -c "import app.main"
ENVIRONMENT=test pytest -q
```

Web (depuis `apps/web`) :

```bash
npm run lint
npm run typecheck
npm test
DOCKER_BUILD=1 FORGE_FONT_MODE=fallback NEXT_PUBLIC_API_URL=http://localhost:8100 npm run build
```

Runtime manifest (depuis la racine du dépôt) :

```bash
cd apps/api/runtime && npm ci && npm test
cd deck && npm ci && npm test
cd ../../../.. && python infra/ci/check_manifest_parity.py
```

Gitleaks, Trivy et Semgrep tournent après les quatre premiers jobs. Corrigez tout signalement sur votre branche avant de demander une review.

---

## Contribuer des kits templates

Les kits templates sont les starters de la galerie Forge, un dossier par kit dans `data/templates/<id>/`. `<id>` respecte `^[a-z0-9][a-z0-9-]{1,62}$` et `template.json` déclare le `kind`. **Designers et développeurs** peuvent en proposer de nouveaux ou améliorer les existants.

Contrat complet : [docs/TEMPLATES.fr.md](docs/TEMPLATES.fr.md) (🇬🇧 [TEMPLATES.md](docs/TEMPLATES.md)) · Vue d'ensemble : [data/templates/README.md](data/templates/README.md)

### Fichiers requis par type

| Type | Fichiers requis | Tests (`apps/api/tests/`) |
| --- | --- | --- |
| Site / appli (`web`, `mobile`) | `template.json`, `DESIGN.md`, `README.md`, `index.html`, `package.json`, `preview.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/styles/*.css`, au moins trois fichiers dans `src/components/` (ou `src/screens/` pour les applis) | `test_templates.py` |
| Slides (`slides`) | `template.json`, `DESIGN.md`, `deck.json`, `slides/*.json`, `notes/*.md` (un par slide), `preview.html`, images sous `public/images/`. Pas de `package.json`. | `test_templates.py`, `test_template_slides.py` |
| Codelab (`codelab`) | `template.json`, `DESIGN.md`, `codelab.json`, `steps/*.md`, `preview.html`, fichiers de départ et de solution optionnels sous `files/`. Pas de `package.json`. | `test_templates.py`, `test_template_codelab.py` |
| Design system (`design_system`) | `template.json`, `DESIGN.md`, `design-system.json`, `preview.html`, le logo désigné par `design-system.json` (par exemple `public/brand/logo.svg`) | `test_templates.py`, `test_template_design_systems.py` |

Règles communes (vérifiées par les tests) :

- `template.json` : `title` et `description` en **en** et **fr**, une palette (`accent`, `bg`, `fg`, `muted`) en `#rrggbb`, et le `kind`.
- `preview.html` est une vignette statique **sans** `<script>`.
- Les sites et applis suivent le contrat de l'agent décrit dans [docs/TEMPLATES.fr.md](docs/TEMPLATES.fr.md) : seulement `react`, `lucide-react` et des imports locaux, un `createRoot` nommé, du CSS mobile-first, des styles de page dans `src/styles/`.
- Les documents slides, codelab et design system doivent être valides selon les schémas de `contracts/forge-design/`.

Les kits slides ont leurs propres guides : [docs/templates/slides-style-guide.md](docs/templates/slides-style-guide.md) (format, layouts, presets) et [docs/templates/slides-sources.md](docs/templates/slides-sources.md) (sources sous licence).

### Workflow de soumission

1. Créez une branche depuis le dernier `dev` (nommez-la `template/<id>` pour un nouveau kit).
2. Ajoutez ou modifiez `data/templates/<id>/` selon le tableau ci-dessus.
3. Enregistrez le nouvel `<id>` dans `apps/api/tests/test_templates.py` : `EXPECTED_SLIDES_IDS`, `EXPECTED_CODELAB_IDS`, `EXPECTED_DESIGN_SYSTEM_IDS`, `EXPECTED_MOBILE_IDS`, ou la liste des sites dans `EXPECTED_IDS`.
4. Lancez les tests de votre type, par exemple `cd apps/api && pytest tests/test_templates.py tests/test_template_slides.py -q`.
5. Ouvrez une PR vers `dev` avec une **capture** de la carte galerie (`preview.html`) et une **capture ou vidéo** d'un projet forké depuis le kit, dans l'éditeur de son type.

Utilisez l'issue [template proposal](.github/ISSUE_TEMPLATE/template_proposal.yml) pour discuter d'un kit **avant** un gros travail de design.

---

## Contribuer des intégrations

Les intégrations sont des entrées de catalogue pour des **embeds statiques** tiers (iframe, script ou lien de paiement) affichées sur `/integrations`. **Designers et développeurs** peuvent ajouter des kits ou améliorer guides et logos. Les SDK Auth/BaaS et les APIs form-action partielles sont hors périmètre.

### Arborescence

Chaque kit vit dans `data/integrations/<id>/` où `<id>` respecte `^[a-z0-9][a-z0-9-]{1,62}$` (exemple : `tally`).

```
data/integrations/<id>/
├── integration.json   # meta : categories, access (yes), methods (iframe|script|link), docsUrl, i18n, logo
├── logo.svg           # logo local (fonctionne hors ligne), ou le fichier nommé dans "logo"
├── guide.en.md        # Get started
└── guide.fr.md
```

Vue d'ensemble : [data/integrations/README.md](data/integrations/README.md) · Contrat : [docs/INTEGRATIONS.fr.md](docs/INTEGRATIONS.fr.md) (🇬🇧 [INTEGRATIONS.md](docs/INTEGRATIONS.md))

### Règles clés (vérifiées par `apps/api/tests/test_integrations.py`)

| Règle | Pourquoi |
| --- | --- |
| `id` de `integration.json` = nom du dossier | URLs stables `/integrations/{id}` |
| `access` = `yes` uniquement | Embeds drop-in seulement, pas de kits partiels |
| `methods` inclut `iframe`, `script` et/ou `link` | Doit marcher sur un site statique en collant |
| `categories` non vide ; `docsUrl` renseigné | Découvrabilité et lien vers la doc officielle |
| `logo.svg` (ou le fichier `logo`) présent en local | Un clone open source fonctionne hors ligne |
| `guide.en.md` + `guide.fr.md` présents, avec un titre, sans `<script>` brut hors des blocs de code | Docs Get started sûres et complètes |

### Workflow de soumission

1. Créez une branche depuis le dernier `dev` (nommez-la `integration/<id>` pour un nouveau kit).
2. Ajoutez ou modifiez `data/integrations/<id>/` selon l'arborescence ci-dessus.
3. Enregistrez le nouvel `<id>` dans `EXPECTED_IDS` (`apps/api/tests/test_integrations.py`).
4. Lancez `cd apps/api && pytest tests/test_integrations.py -q`.
5. Ouvrez une PR vers `dev` avec une capture de la carte catalogue et de la page Get started.

Utilisez l'issue [integration proposal](.github/ISSUE_TEMPLATE/integration_proposal.yml) pour discuter d'une intégration **avant** une longue rédaction.

---

## Style de code

- **Python :** `ruff` (format + check)
- **TypeScript :** ESLint + `tsc`
- Suivre les conventions existantes ; pas de refactor hors sujet dans la PR.

---

## Facturation / FRODI (périmètre)

Les plans, les dotations et les e-mails de campagne relèvent du plan de contrôle
RodiumAi, pas de ce dépôt. Ici vous pouvez :

- Consommer les entitlements dans l'UI (`/auth/forge/status`, badge wallet).
- Ajuster les textes Cloud et l'affichage FRODI/RODI.
- Garder le self-host fonctionnel avec une clé API RodiumAi collée (`rd_sk_…`) quand OIDC/Cloud est désactivé.

N'ouvrez **pas** de PR ici pour changer les catalogues de plans, les dotations ou
le mailing de campagne : cela relève du plan de contrôle RodiumAi.

---

## Où demander de l'aide

- **Questions & idées :** ouvrez une GitHub Issue avec l'un des modèles
- **Sécurité :** [SECURITY.fr.md](SECURITY.fr.md) (advisories privées, ou forge@rodiumai.io)
- **Code de conduite :** [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md) (signalements en privé à forge@rodiumai.io)
