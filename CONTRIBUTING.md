> 🇫🇷 [Version française](CONTRIBUTING.fr.md)

# Contributing to Forge

Thank you for your interest in Forge. This project follows **strict collaboration rules** so that every change is traceable, reviewable, and safe for production (`forge.rodiumai.io` / `api-forge.rodiumai.io`).

**Read this document in full before opening an issue or pull request.**

---

## Who can contribute

Contributions are welcome from the roles below. Stay within your scope; maintainers may redirect work that belongs in another track.

### Designers

You **may**:

- Open **issues** with screenshots, mockups, or Figma exports describing UX/UI improvements.
- Propose flows, copy, layout, and accessibility fixes.
- Upload design assets (PNG, SVG, short screen recordings) directly in the issue or PR.
- **Contribute frontend code** in `apps/web` when you implement or refine UI (components, styles, landing, editors).
- **Propose or co-author template kits** in `data/templates/` (sites, apps, slides, codelabs, design systems). See [Contributing template kits](#contributing-template-kits).
- **Propose or co-author integrations** in `data/integrations/` (embed catalog). See [Contributing integrations](#contributing-integrations).

You **must not**:

- Change API contracts, infrastructure, or security-sensitive code without pairing with a backend maintainer.

**Preferred templates:** [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) · [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml) · [Template proposal](.github/ISSUE_TEMPLATE/template_proposal.yml)

### Cybersecurity

**Test against your own local stack, not our production hosts.** `docker compose
up` gives you the whole system; that is the supported target for security work.
We do not operate a bug bounty, and we do not grant blanket permission to test
`rodiumai.io` or any of its subdomains.

You **may**:

- Audit **your own local deployment**, and any site you published yourself.
- Review this repository's source for vulnerabilities (no permission needed).
- Report confirmed vulnerabilities via **GitHub Security Advisories** (private), or by email to **forge@rodiumai.io**. See [SECURITY.md](SECURITY.md).
- Open a **public issue** only for non-sensitive hardening ideas (headers, CSP suggestions, dependency hygiene) with a **written report** and **screenshots / proof-of-concept** where appropriate.

You **must not**:

- Test our hosted environments without **prior written authorisation**, which you can request at forge@rodiumai.io. Unauthorised testing against them may be unlawful in your jurisdiction, whatever your intent.
- Perform intrusive testing (DoS, brute force, social engineering). This is never in scope, even against a host you were authorised to test.
- Access, modify or retain data that is not yours, and never use another user's account.
- Disclose exploitable details publicly before a fix is released.

Report in good faith, stay within the scope above, and we will not pursue legal
action over your research.

### Frontend & backend developers

You **may**:

- Implement features, fix bugs, and improve prompts, orchestration, editors, templates, and runtime behavior.
- Propose architectural changes via an issue **before** large refactors.
- Touch `apps/web`, `apps/api`, `apps/api/runtime`, `contracts/`, `data/templates` and `data/integrations` according to the change.
- **Add or improve template kits**. See [Contributing template kits](#contributing-template-kits).
- **Add or improve integrations**. See [Contributing integrations](#contributing-integrations).

You **must**:

- Add or update **tests** for any behavior change.
- Keep PRs **small and focused** (one topic per PR).

---

## Branches

| Branch | Role |
| --- | --- |
| `dev` | Integration branch. **Open every pull request against `dev`.** |
| `main` | Release branch. Maintainers merge `dev` into `main` through a release PR; a merge to `main` deploys production. |

Do not open feature or fix PRs against `main`.

## How to submit work (mandatory)

### 1. Stay up to date with `dev`

Before starting work **and again before opening or updating a PR**:

```bash
git fetch origin
git checkout your-branch
git rebase origin/dev   # or: git merge origin/dev
```

**PRs that are behind `dev` or conflict with it will not be merged** until they are rebased and the checks pass.

### 2. Branch & commits

1. Fork the repository (external contributors) or branch from `dev` (org members).
2. Use a clear branch name: `feat/…`, `fix/…`, `design/…`, `security/…`, `template/…`, `integration/…`.
3. Write commit messages in the form `type(scope): summary` (English or French).

### 3. Pull request requirements (strict)

Every PR **must** include:

| Requirement | Details |
| --- | --- |
| **Clear summary** | What changed and **why** (not only what files moved). |
| **Project kind** | The kind it touches: site / app, slides, codelab, design system, or none in particular. |
| **Linked issues** | `Fixes #123` or `Relates to #456` when applicable. |
| **Screenshots** | **Mandatory** for any UI/UX change (before/after when relevant). |
| **Demo video** | **Strongly recommended** for new features or non-trivial flows (a short screen recording, 30 to 90 seconds). |
| **Tests** | The commands you ran (see [Checks (CI)](#checks-ci)). |
| **Review hygiene** | **Reply to every review comment** as soon as possible; resolve threads or explain why not. |

Incomplete PRs (missing visuals for UI work, no test evidence, or silent review threads) **will be closed or sent back** until fixed.

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and keep all of its sections.

### 4. Review & merge

- At least one maintainer approval is required.
- The checks listed in [Checks (CI)](#checks-ci) must pass.
- Maintainers merge into `dev` after a rebase on the latest `dev`.

---

## Where the code lives

Forge builds five project kinds. Sites and apps are React projects edited in the builder; slides, codelabs and design systems are documents, each with its own editor and player.

| Kind | `kind` id | Web (`apps/web`) | API (`apps/api`) | Templates |
| --- | --- | --- | --- | --- |
| Site | `web` | `components/builder/` | `app/services/orchestration/`, `app/services/scaffold.py`, `runtime/` | `data/templates/<id>/` |
| App (mobile) | `mobile` | `components/builder/` | same as sites | `data/templates/<id>/` |
| Slides | `slides` | `components/deck-editor/`, `components/deck-player/`, `components/deck-exports/` | `app/services/deck_ai/`, `app/services/exports/`, `runtime/deck/` (player bundle, PPTX) | `data/templates/slides-*/` |
| Codelab | `codelab` | `components/codelab-editor/`, `components/codelab-player/` | `app/services/codelab/`, `runtime/codelab/` (player bundle) | `data/templates/codelab-*/` |
| Design system | `design_system` | `components/design-system/` | `app/services/design_system/` | `data/templates/design-system-*/` |

Shared pieces:

- `apps/api/app/kinds/`: the kind registry (editor, exports, publishing and feature flag of each kind). `apps/web/lib/kinds.ts` mirrors it.
- `contracts/forge-design/`: JSON schemas of the deck, slide, codelab and design system documents.
- `apps/api/runtime/`: the in-browser Babel runner of sites and apps. `packages.json` is the single source of truth for the import map, the AST allowlist and the Monaco types.
- `apps/api/app/db.py`: the database schema. There are no migration files: the API applies idempotent DDL at startup.
- `data/integrations/`: the embed catalog shown on `/integrations`.

---

## Development setup

CI uses **Python 3.12** and **Node 22**. Use the same versions locally.

Start the stack with Docker first:

```bash
cp .env.example .env
docker compose up -d --build   # or: make up
```

`make up` also applies the schema and prints the local URLs (UI on http://localhost:3100, API docs on http://localhost:8100/docs). See [DOCKER.md](DOCKER.md) for the full local stack.

### Enable slides, codelabs and design systems

Sites and apps are always on. The three document kinds ship **off** by default. To work on them, switch them on for the API:

```bash
FORGE_KIND_SLIDES_ENABLED=true
FORGE_KIND_CODELAB_ENABLED=true
FORGE_KIND_DESIGN_SYSTEM_ENABLED=true
```

- With Docker, add them to the root `.env`, then recreate the API container: `docker compose up -d --force-recreate api`.
- With the API on the host, add them to `apps/api/.env` and restart uvicorn.

The web app needs no flag: it asks the API which kinds are on (`GET /kinds`).

Optional: `PIXABAY_API_KEY` (server side only) turns on the free image search of the image panel. Left empty, that search answers 503 and the rest of the panel still works.

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
python -m venv .venv && .venv/Scripts/activate   # or: source .venv/bin/activate
pip install --require-hashes -r requirements-dev.txt   # runtime deps + ruff + pytest
uvicorn app.main:app --reload --port 8100
```

Edit `requirements.in` or `requirements-dev.in`, then run `make lock` from the
repository root. Commit both the input and the compiled lock; do not hand-edit the
generated `.txt` files. CI fails when a lock does not match its input.

Some API tests run the Node runtimes. Install them once before running pytest:

```bash
cd apps/api/runtime && npm ci
cd deck && npm ci
```

Set `TEMPLATES_ROOT` / `INTEGRATIONS_ROOT` when running tests outside Docker (CI sets both):

```bash
export TEMPLATES_ROOT="$(pwd)/../../data/templates"   # from apps/api
export INTEGRATIONS_ROOT="$(pwd)/../../data/integrations"
```

From the repository root, `make test` runs `pytest -q` on the host with `TEMPLATES_ROOT` set.

### Codelab player (API on the host)

The API Docker image builds the codelab player itself. With the API on the host, build it once before publishing or exporting a codelab:

```bash
cd apps/web
npm run build:codelab-player   # output: apps/api/runtime/codelab/dist
```

---

## Checks (CI)

`.github/workflows/ci.yml` runs on every push to `dev` and `main`, and on pull requests to `main`. It does **not** run on pull requests to `dev`, so **run the checks below locally** before you open or update a PR, and list them in the PR.

| Job | What it runs | Locally |
| --- | --- | --- |
| **API** | Lock check, `pip check`, Ruff lint and format check, app import, pytest (template and integration contracts included) | see below |
| **Web** | ESLint, TypeScript, Vitest, production build | see below |
| **Runtime manifest** | Runtime tests, deck runtime tests, import map / AST allowlist parity | see below |
| **Docker compose** | `docker compose config --quiet` on a copy of `.env.example` | `cp .env.example .env && docker compose config --quiet` |
| **Gitleaks** | Secret scan of the full history (`.gitleaks.toml`) | optional, Docker image `ghcr.io/gitleaks/gitleaks` |
| **Trivy** | Filesystem scan, CRITICAL and HIGH vulnerabilities that have a fix | optional, Docker image `aquasec/trivy` |
| **Semgrep** | SAST on `apps/web` (with `.semgrep/rules/rodiumai-frontend.yml`) and on `apps/api/app` | optional, Docker image `semgrep/semgrep` |

API (from `apps/api`, after installing the runtimes above):

```bash
ruff check app tests
ruff format --check app tests
ENVIRONMENT=test python -c "import app.main"
ENVIRONMENT=test pytest -q
```

Web (from `apps/web`):

```bash
npm run lint
npm run typecheck
npm test
DOCKER_BUILD=1 FORGE_FONT_MODE=fallback NEXT_PUBLIC_API_URL=http://localhost:8100 npm run build
```

Runtime manifest (from the repository root):

```bash
cd apps/api/runtime && npm ci && npm test
cd deck && npm ci && npm test
cd ../../../.. && python infra/ci/check_manifest_parity.py
```

Gitleaks, Trivy and Semgrep run after the first four jobs. Fix any finding on your branch before requesting review.

---

## Contributing template kits

Template kits are the starters shown in the Forge gallery, one folder per kit in `data/templates/<id>/`. `<id>` matches `^[a-z0-9][a-z0-9-]{1,62}$`, and `template.json` declares the `kind`. **Designers and developers** can contribute new kits or improve existing ones.

Full contract: [docs/TEMPLATES.md](docs/TEMPLATES.md) (🇫🇷 [TEMPLATES.fr.md](docs/TEMPLATES.fr.md)) · Overview: [data/templates/README.md](data/templates/README.md)

### Required files per kind

| Kind | Required files | Tests (`apps/api/tests/`) |
| --- | --- | --- |
| Site / app (`web`, `mobile`) | `template.json`, `DESIGN.md`, `README.md`, `index.html`, `package.json`, `preview.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/styles/*.css`, at least three files in `src/components/` (or `src/screens/` for apps) | `test_templates.py` |
| Slides (`slides`) | `template.json`, `DESIGN.md`, `deck.json`, `slides/*.json`, `notes/*.md` (one per slide), `preview.html`, images under `public/images/`. No `package.json`. | `test_templates.py`, `test_template_slides.py` |
| Codelab (`codelab`) | `template.json`, `DESIGN.md`, `codelab.json`, `steps/*.md`, `preview.html`, optional starter and solution files under `files/`. No `package.json`. | `test_templates.py`, `test_template_codelab.py` |
| Design system (`design_system`) | `template.json`, `DESIGN.md`, `design-system.json`, `preview.html`, the logo that `design-system.json` points to (for example `public/brand/logo.svg`) | `test_templates.py`, `test_template_design_systems.py` |

Common rules (checked by the tests):

- `template.json`: `title` and `description` in **en** and **fr**, a palette (`accent`, `bg`, `fg`, `muted`) in `#rrggbb`, and the `kind`.
- `preview.html` is a static thumbnail with **no** `<script>`.
- Sites and apps follow the agent contract described in [docs/TEMPLATES.md](docs/TEMPLATES.md): only `react`, `lucide-react` and local imports, a named `createRoot`, mobile-first CSS, page styles in `src/styles/`.
- Slides, codelab and design system documents must validate against the schemas in `contracts/forge-design/`.

Slides kits have their own guides: [docs/templates/slides-style-guide.md](docs/templates/slides-style-guide.md) (format, layouts, presets) and [docs/templates/slides-sources.md](docs/templates/slides-sources.md) (licensed sources).

### Submission workflow

1. Branch from the latest `dev` (name it `template/<id>` when adding a kit).
2. Add or edit `data/templates/<id>/` following the table above.
3. Register the new `<id>` in `apps/api/tests/test_templates.py`: `EXPECTED_SLIDES_IDS`, `EXPECTED_CODELAB_IDS`, `EXPECTED_DESIGN_SYSTEM_IDS`, `EXPECTED_MOBILE_IDS`, or the site list inside `EXPECTED_IDS`.
4. Run the tests of your kind, for example `cd apps/api && pytest tests/test_templates.py tests/test_template_slides.py -q`.
5. Open a PR against `dev` with a **screenshot** of the gallery card (`preview.html`) and a **screenshot or video** of a project forked from the kit, in the editor of its kind.

Use the [template proposal](.github/ISSUE_TEMPLATE/template_proposal.yml) issue to discuss a kit **before** large design work.

---

## Contributing integrations

Integrations are catalog entries for third-party **static embeds** (iframe, script or checkout link) shown on `/integrations`. **Designers and developers** can add kits or improve guides and logos. Auth/BaaS SDKs and partial form-action APIs are out of scope.

### Folder layout

Each kit lives at `data/integrations/<id>/` where `<id>` matches `^[a-z0-9][a-z0-9-]{1,62}$` (example: `tally`).

```
data/integrations/<id>/
├── integration.json   # meta: categories, access (yes), methods (iframe|script|link), docsUrl, i18n, logo
├── logo.svg           # vendored logo (works offline), or the file named in "logo"
├── guide.en.md        # Get started
└── guide.fr.md
```

Overview: [data/integrations/README.md](data/integrations/README.md) · Full contract: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) (🇫🇷 [INTEGRATIONS.fr.md](docs/INTEGRATIONS.fr.md))

### Key rules (checked by `apps/api/tests/test_integrations.py`)

| Rule | Why |
| --- | --- |
| `integration.json` `id` equals the folder name | Stable URLs `/integrations/{id}` |
| `access` is `yes` only | Drop-in embeds only, no partial kits |
| `methods` includes `iframe`, `script` and/or `link` | Must work on a static site by paste |
| `categories` non-empty; `docsUrl` set | Discoverability and a link to the official docs |
| `logo.svg` (or the `logo` file) present locally | An open-source clone works offline |
| `guide.en.md` + `guide.fr.md` present, with a heading, no raw `<script>` outside code blocks | Get started docs stay safe and complete |

### Submission workflow

1. Branch from the latest `dev` (name it `integration/<id>` when adding a kit).
2. Add or edit `data/integrations/<id>/` following the layout above.
3. Register the new `<id>` in `EXPECTED_IDS` (`apps/api/tests/test_integrations.py`).
4. Run `cd apps/api && pytest tests/test_integrations.py -q`.
5. Open a PR against `dev` with a screenshot of the catalog card and of the Get started page.

Use the [integration proposal](.github/ISSUE_TEMPLATE/integration_proposal.yml) issue to discuss an integration **before** large write-ups.

---

## Code style

- **Python:** `ruff` (format + check)
- **TypeScript:** ESLint + `tsc`
- Match existing patterns; avoid drive-by refactors unrelated to your PR.

---

## Billing / FRODI (scope note)

Plans, allotments and campaign emails are owned by the RodiumAi control plane,
not by this repository. In this repo you may:

- Consume entitlements in the UI (`/auth/forge/status`, wallet badge).
- Adjust Cloud UX copy and the FRODI/RODI display.
- Keep self-host working with a pasted RodiumAi API key (`rd_sk_…`) when OIDC/Cloud is off.

Do **not** open PRs here that change plan catalogs, grants or campaign mailing:
those belong to the RodiumAi control plane.

---

## Getting help

- **Questions & ideas:** open a GitHub Issue using one of the templates
- **Security:** [SECURITY.md](SECURITY.md) (private advisories, or forge@rodiumai.io)
- **Code of conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) (reports go privately to forge@rodiumai.io)
