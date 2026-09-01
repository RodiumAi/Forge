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

Vous **ne devez pas** :

- Modifier les contrats API, l'infrastructure ou le code sensible sécurité sans l'accord d'un maintainer backend.

**Modèles recommandés :** [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) · [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)

### Cybersécurité

Vous **pouvez** :

- Auditer **`https://api-forge.rodiumai.io`** et **`https://forge.rodiumai.io`** (et les sites publiés `*.forge.rodiumai.io` si pertinent).
- Signaler les vulnérabilités confirmées via les **GitHub Security Advisories** (privé) — voir [SECURITY.fr.md](SECURITY.fr.md).
- Ouvrir une **issue publique** uniquement pour des idées de durcissement non sensibles (en-têtes, CSP, hygiène des dépendances), avec un **rapport écrit** et des **captures / preuves** si possible.

Vous **ne devez pas** :

- Mener des tests intrusifs (DoS, brute force, ingénierie sociale) sans accord écrit des maintainers.
- Divulguer publiquement des détails exploitables avant qu'un correctif soit publié.

### Développeurs frontend & backend

Vous **pouvez** :

- Implémenter des fonctionnalités, corriger des bugs, améliorer les prompts, l'orchestration, les templates et le runtime.
- Proposer des changements d'architecture via une issue **avant** les gros refactors.
- Toucher `apps/web`, `apps/api`, `apps/api/runtime` et `data/templates` selon le périmètre du changement.

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
2. Nom de branche explicite : `feat/…`, `fix/…`, `design/…`, `security/…`.
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
pip install -r requirements.txt
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

Voir [docs/TEMPLATES.md](docs/TEMPLATES.md).

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

## Déploiement production (maintainers)

Après merge sur `main` :

| Composant | Déclencheur |
| --- | --- |
| **Frontend** (`forge.rodiumai.io`) | AWS Amplify — `apps/web/amplify.yml` |
| **API** (`api-forge.rodiumai.io`) | GitHub Actions `deploy-api.yml` → ECR → ECS Fargate |

Voir [docs/DEPLOYMENT.fr.md](docs/DEPLOYMENT.fr.md) et [infra/aws/github/README.md](infra/aws/github/README.md).

---

## Style de code

- **Python :** `ruff` (format + check)
- **TypeScript :** ESLint + `tsc`
- Suivre les conventions existantes ; pas de refactor hors sujet dans la PR.

---

## Où demander de l'aide

- **Questions & idées :** GitHub Issues / Discussions
- **Sécurité :** [SECURITY.fr.md](SECURITY.fr.md) — advisories privées uniquement pour les vulnérabilités
- **Code de conduite :** [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md)
