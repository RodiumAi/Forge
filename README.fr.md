# Forge

<p align="center">
  <img src="sc/home.png" alt="Forge par RodiumAi, page d’accueil" width="900" />
</p>

<p align="center">
  <a href="https://github.com/RodiumAi/Forge/actions/workflows/ci.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/RodiumAi/Forge/ci.yml?branch=main&label=Tests&logo=github&style=for-the-badge" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <a href="LICENSE"><img alt="Licence : MIT" src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" /></a>
</p>

> 🇬🇧 [English version](README.md)

Forge est un builder open source propulsé par l'IA. Décrivez ce que vous voulez dans un chat et Forge le construit avec vous : sites et applis, présentations, codelabs et design systems. Chaque type de projet a son éditeur, son IA, ses templates, sa publication et ses exports.

| Type | Ce que vous obtenez | Comment c'est construit |
| --- | --- | --- |
| **Web** | Un site web | Du code React frontend-only écrit par l'agent, prévisualisé dans le navigateur, publié en site statique ESM |
| **Appli** | Une appli au format mobile | Le même moteur que Web, avec des règles de mise en page mobile |
| **Slides** | Une présentation | Un document JSON rendu par le player de présentations Forge |
| **Codelab** | Un tutoriel pas à pas avec des fichiers de code | Un document JSON rendu par le player de codelabs Forge |
| **Design system** | Tokens, composants et charte de marque | Un document JSON rendu sous forme de site de design system |

Web et Appli sont toujours disponibles. Slides, Codelab et Design system sont désactivés par défaut sur une instance auto-hébergée : voir [Activer les types de projet](#activer-les-types-de-projet).

## Deux modes

| | **Self-host (ce dépôt)** | **Forge Cloud** ([forge.rodiumai.io](https://forge.rodiumai.io)) |
| --- | --- | --- |
| **Comptes** | Email/mot de passe local (+ Google optionnel, OIDC RodiumAi optionnel) | SSO RodiumAi (OIDC) |
| **Crédits** | Collez votre propre clé API RodiumAi (`rd_sk_…`) | **FRODI** d'abord (quota du plan), wallet **RODI** en secours |
| **Offre gratuite** | Apportez votre clé | **500 FRODI / mois** sur Free |
| **Plans / facturation** | Aucun | Plans Forge gérés par le control plane RodiumAi |
| **Templates, exports** | Tous, sans vérification de plan | Selon le plan du compte |

Le self-host ne dépend d'aucun service que vous ne pouvez pas faire tourner. Les droits Cloud et les attributions de plan vivent dans le control plane RodiumAi (Nest). Ce dépôt se contente de les lire, via `/auth/forge/status` et le `/internal/forge/balance` du gateway.

## Architecture

```
Forge/
├── apps/
│   ├── web/             # Next.js 15 + TypeScript : UI du builder et éditeurs de documents
│   └── api/             # FastAPI + SQLAlchemy + Postgres : API, agent, orchestration
│       ├── app/kinds/   # Registre des types de projet (web, mobile, slides, codelab, design_system)
│       └── runtime/     # Runner Babel dans le navigateur (JS pur) + manifest packages.json
│           ├── deck/    # Bundle du player de présentations et export PPTX (Node)
│           └── codelab/ # Build du player de codelabs (Node)
├── data/
│   ├── templates/       # 86 kits de départ (voir docs/TEMPLATES.fr.md)
│   └── integrations/    # Catalogue d'embeds (voir docs/INTEGRATIONS.fr.md)
└── infra/               # Docker local + outils CI
```

Les 86 kits de `data/templates/`, selon le champ `kind` de leur `template.json` :

| `kind` | Kits |
| --- | --- |
| `web` | 24 |
| `mobile` (Appli) | 12 |
| `slides` | 36 |
| `codelab` | 8 |
| `design_system` | 6 |

Services d'appui : **MinIO** (uploads S3 et fichiers publiés), **Valkey** (file des runs, annulation), **Caddy** (sites publiés sur `*.lvh.me:8080`), **Mailpit** (mail local), **Adminer** (console DB). Les appels LLM passent par le gateway **RodiumAi**.

Il n'y a pas de fichiers de migration : l'API applique un schéma idempotent (`apps/api/app/db.py`) à chaque démarrage.

## Fonctionnalités clés

### Sites et applis

- **Du chat au site** : décrivez un site ou une appli ; l'agent génère un projet React frontend-only.
- **Preview instantanée** : runner Babel/ESM dans le navigateur avec une import map CDN (esm.sh). Ni node_modules, ni Vite.
- **Publication** : build de production (bundlé, minifié, hashé, dépendances embarquées), chaque route pré-rendue avec son titre et ses metas, `404.html`, sitemap, robots, données structurées et en-têtes de cache, servi par Caddy.
- **Charte de marque au premier build** : palette, paire Google Fonts et direction d'images tirées du brief, plus les premières images générées (WebP + srcset).
- **Édition visuelle** : texte et images, directement sur la preview, avec le menu contextuel Forge.
- **Panneau d'images** : images générées, uploads et une banque d'images libres optionnelle (Pixabay, recherche côté serveur).
- **Historique et retour arrière** : snapshots git par projet.
- **Export ZIP** : un vrai projet Vite exécutable.
- **Lien vers un design system** : un site ou une appli peut suivre une version d'un design system ; une version plus récente ne s'applique qu'après votre confirmation.
- **Assets ou références** : les logos vont dans `public/` ; les captures guident la mise en page. Collez l'URL d'un site pour capturer des références desktop et mobile (Playwright).
- **Catalogue d'intégrations** : des embeds prêts à l'emploi, voir [docs/INTEGRATIONS.fr.md](docs/INTEGRATIONS.fr.md).
- **Manifest du runtime** : `packages.json` est la source unique de l'import map, de l'allowlist AST et des types Monaco.

### Slides

- **Éditeur de présentations** : rail de slides, canevas, panneau de calques, panneau de propriétés et barre de mise en forme.
- **IA des présentations** : plan, mises en page, modifications ciblées, thèmes et visuels depuis le chat, avec saisie vocale.
- **Import** : joignez un fichier PowerPoint (`.pptx`) ou PDF au chat de la présentation.
- **Présenter et publier** : mode présentation et player publié.
- **Exports** : PDF, PNG, HTML et PPTX (le runtime Node de `apps/api/runtime/deck/` construit le bundle du player et le PPTX).

### Codelabs

- **Éditeur d'étapes** avec IA, plus fichiers de départ et de solution.
- **Player et publication** : un player de codelab publié.
- **Import et export** : Markdown en entrée et en sortie (compatible claat), export PDF et ZIP.

### Design systems

- **Tokens, composants et charte de marque**, générés et modifiés avec l'IA.
- **Exports** : `tokens.json` (format W3C), variables CSS, Tailwind, charte de marque (Markdown, PDF).
- **Partage** : partagez un design system avec votre équipe.

### Pour tous les types

- **Templates** : 36 kits de sites et d'applis, 36 kits de slides, 8 codelabs et 6 design systems. Voir [docs/TEMPLATES.fr.md](docs/TEMPLATES.fr.md).
- **Collaboration** : invitez des collaborateurs sur un projet.
- **Badge FRODI (Cloud)** : plan et solde FRODI dans la barre latérale ; RODI quand les FRODI sont épuisés ou absents.

<p align="center">
  <img src="sc/preview.png" alt="Builder Forge, chat et preview live" width="900" />
</p>

## Plans (Forge Cloud)

**FRODI d'abord**, RODI quand il en faut plus. Les FRODI sont des crédits Forge (hebdomadaires sur les plans payants, mensuels sur Free) et expirent ; les RODI restent dans le wallet RodiumAi. Free inclut 500 FRODI par mois.

<p align="center">
  <img src="sc/plan.png" alt="Page des tarifs Forge" width="900" />
</p>

Le catalogue des plans (prix, quotas, fonctionnalités) est servi par le control plane RodiumAi ; le builder affiche les droits et les consomme. Sur le Cloud, le plan décide des templates qui peuvent démarrer un projet et des formats d'export disponibles. Une instance auto-hébergée n'a pas de plan et n'applique aucune de ces limites.

## Prérequis

| Outil | Version | Nécessaire pour |
| --- | --- | --- |
| Docker + Compose v2 | version courante | le démarrage rapide ci-dessous |
| Node.js | **22** (`.nvmrc`) | lancer `apps/web` et les runtimes sur l'hôte |
| Python | **3.12** (`.python-version`) | lancer `apps/api` sur l'hôte |

La CI tourne exactement sur ces versions. Des runtimes plus anciens peuvent
compiler en local et échouer en CI : `ruff` cible `py312` et plusieurs
dépendances sont sensibles à la version.

> **En self-host, la connexion fonctionne immédiatement.** Créez un compte
> local sur `/register` (email/mot de passe). Google est optionnel (variables
> Firebase). **"Continuer avec RodiumAi"** n'apparaît que si
> `RODIUM_OIDC_CLIENT_ID` est renseigné ; sinon le bouton reste masqué. Sur
> Forge Cloud, le SSO OIDC est le chemin principal et le plan Free est accordé
> par le control plane.

## Démarrage rapide (Docker)

```bash
cp .env.example .env
make up          # docker compose up -d --build, puis make migrate
```

Sans `make` :

```bash
cp .env.example .env
docker compose up -d --build
```

L'API applique le schéma à son démarrage ; `make migrate` relance la même
étape à la main.

| Service | URL |
| --- | --- |
| UI du builder | http://localhost:3100 |
| Docs API | http://localhost:8100/docs |
| Sites publiés | http://\<slug\>.lvh.me:8080 |
| Console MinIO | http://localhost:9001 |
| Adminer | http://localhost:8089 |
| Mail (Mailpit) | http://localhost:8026 |

[DOCKER.fr.md](DOCKER.fr.md) liste chaque service, port et cible `make`.

## Première utilisation : compte et clé de génération

**1. Créez un compte.** Ouvrez http://localhost:3100/register et inscrivez-vous.
Vous êtes connecté immédiatement.

**2. Confirmez votre e-mail.** La stack embarque un conteneur Mailpit : le mail
est réel, il ne quitte simplement pas votre machine. Ouvrez
**http://localhost:8026**, le message de confirmation vous y attend, lien
compris. La réinitialisation du mot de passe fonctionne de la même façon.

L'API tourne sur l'hôte plutôt qu'en Docker ? `mailpit` n'y est pas résolu :
mettez `MAIL_TRANSPORT=console` et les liens s'affichent dans les logs de
l'API. Pour un vrai envoi, `MAIL_TRANSPORT=ses` (avec les identifiants `AWS_*`).

**3. Ajoutez une clé de génération (self-host).** Forge n'embarque pas de
modèle ; vous apportez les identifiants. Créez un compte gratuit sur
[rodiumai.io](https://rodiumai.io), copiez une clé API (`rd_sk_prod_…`) et
collez-la dans Forge sous **Réglages → Connexion RodiumAi**. Le bouton
**Tester l’API** la vérifie avant que vous comptiez dessus.

Sur **Forge Cloud**, les comptes liés utilisent leur plan (FRODI) au lieu d'une
clé collée ; la barre latérale affiche le solde.

`RODIUM_BASE_URL` doit correspondre à l'endroit où la clé est valide. La valeur
fournie, `https://api.rodiumai.io/v1`, convient à une clé rodiumai.io ; ne la
changez que si vous faites tourner votre propre gateway.

La connexion Google est optionnelle : renseignez `FIREBASE_*` (API) et
`NEXT_PUBLIC_FIREBASE_*` (build web) pour afficher le bouton Google sur
`/login` et `/register`. Laissez-les vides et le bouton n'est pas rendu.
Activez **Google** dans la console Firebase et ajoutez votre domaine aux
domaines autorisés. La connexion GitHub n'est pas proposée.

## Configuration

Copiez `.env.example` vers `.env` et ajustez-le. Il documente les variables
essentielles (base de données, MinIO, Valkey, gateway RodiumAi, OIDC, mail,
modèles). `apps/api` et `apps/web` ont chacun leur `.env.example` pour le
développement sur l'hôte.

### Activer les types de projet

Slides, Codelab et Design system sont livrés désactivés. Chacun a un réglage
côté API, lu dans l'environnement (`apps/api/app/config.py`) :

| Variable | Type |
| --- | --- |
| `FORGE_KIND_SLIDES_ENABLED` | Slides |
| `FORGE_KIND_CODELAB_ENABLED` | Codelab |
| `FORGE_KIND_DESIGN_SYSTEM_ENABLED` | Design system |

Décommentez dans `.env` ceux que vous voulez, passez-les à `true`, puis
recréez le conteneur de l'API pour qu'il lise les nouvelles valeurs :

```bash
docker compose up -d api
```

L'app web demande à l'API quels types sont actifs (`GET /kinds`) : rien à
changer côté web. Un type désactivé ne peut pas être créé. Web et Appli sont
toujours actifs.

### Banque d'images libres (optionnelle)

`PIXABAY_API_KEY` active la recherche d'images libres dans le panneau
d'images. Obtenez une clé sur
[pixabay.com/api/docs](https://pixabay.com/api/docs/). Elle reste sur le
serveur et n'est jamais envoyée au navigateur. Laissez-la vide et cette
recherche répond `503` ; les images générées et les uploads fonctionnent
toujours.

## Développement hybride (infra Docker + api/web en local)

Lancez l'infra avec Docker, puis l'API et/ou le web en local.

**API**

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install --require-hashes -r requirements-dev.txt # deps runtime + ruff + pytest
cp .env.example .env
uvicorn app.main:app --reload --port 8100
```

**Web**

```bash
cd apps/web
npm install
npm run dev   # port 3100
```

## Tests et vérifications

Ce sont les commandes de la CI (`.github/workflows/ci.yml`) : un run local vert
signifie une CI verte.

```bash
# apps/web
npm run lint && npm run typecheck && npm test
FORGE_FONT_MODE=fallback npm run build

# apps/api  (TEMPLATES_ROOT → data/templates, INTEGRATIONS_ROOT → data/integrations ; voir CONTRIBUTING)
# La CI lance `npm ci` dans apps/api/runtime et apps/api/runtime/deck avant ces commandes.
ruff check app tests && ruff format --check app tests
pytest -q

# apps/api/runtime
npm ci && npm test

# apps/api/runtime/deck
npm ci && npm test

# racine du dépôt : l'import map et l'allowlist AST doivent concorder
python infra/ci/check_manifest_parity.py
```

## Contribuer

Les contributions sont bienvenues. [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md)
couvre le setup, les vérifications à lancer avant de pousser, le processus de
PR et la soumission d'un kit template ou d'intégration. Merci de lire aussi le
[Code de conduite](CODE_OF_CONDUCT.fr.md).

En contribuant, vous acceptez que vos contributions soient placées sous la
licence MIT qui couvre ce projet.

## Documentation

- [docs/README.md](docs/README.md) : index de la documentation publique, en anglais et en français
- [docs/ARCHITECTURE.fr.md](docs/ARCHITECTURE.fr.md) : le fonctionnement d'un run, de la preview et de la publication
- [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) : setup, vérifications, guide de PR, templates et intégrations
- [docs/TEMPLATES.fr.md](docs/TEMPLATES.fr.md) : contrat de création des templates
- [docs/INTEGRATIONS.fr.md](docs/INTEGRATIONS.fr.md) : contrat du catalogue d'embeds
- [DOCKER.fr.md](DOCKER.fr.md) : stack locale, ports, image de l'API
- [SUPPORT.fr.md](SUPPORT.fr.md) : où trouver de l'aide
- [SECURITY.fr.md](SECURITY.fr.md) : signaler une vulnérabilité
- [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md)
- [LICENSE](LICENSE) : MIT
