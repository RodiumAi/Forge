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
- **Contribute frontend code** in `apps/web` when you implement or refine UI (components, styles, landing, builder).
- **Propose or co-author template kits** in `data/templates/` (gallery starters) — see [Contributing template kits](#contributing-template-kits) below.

You **must not**:

- Change API contracts, infrastructure, or security-sensitive code without pairing with a backend maintainer.

**Preferred templates:** [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) · [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)

### Cybersecurity

**Test against your own local stack, not our production hosts.** `docker compose
up` gives you the whole system; that is the supported target for security work.
We do not operate a bug bounty, and we do not grant blanket permission to test
`rodiumai.io` or any of its subdomains.

You **may**:

- Audit **your own local deployment**, and any site you published yourself.
- Review this repository's source for vulnerabilities — no permission needed.
- Report confirmed vulnerabilities via **GitHub Security Advisories** (private), or by email to **forge@rodiumai.io** — see [SECURITY.md](SECURITY.md).
- Open a **public issue** only for non-sensitive hardening ideas (headers, CSP suggestions, dependency hygiene) with a **written report** and **screenshots / proof-of-concept** where appropriate.

You **must not**:

- Test our hosted environments without **prior written authorisation**, which you can request at forge@rodiumai.io. Unauthorised testing against them may be unlawful in your jurisdiction, whatever your intent.
- Perform intrusive testing (DoS, brute force, social engineering) — this is never in scope, even against a host you were authorised to test.
- Access, modify or retain data that is not yours, and never use another user's account.
- Disclose exploitable details publicly before a fix is released.

Report in good faith, stay within the scope above, and we will not pursue legal
action over your research.

### Frontend & backend developers

You **may**:

- Implement features, fix bugs, and improve prompts, orchestration, templates, and runtime behavior.
- Propose architectural changes via an issue **before** large refactors.
- Touch `apps/web`, `apps/api`, `apps/api/runtime`, and `data/templates` according to the change.
- **Add or improve template kits** — see [Contributing template kits](#contributing-template-kits).

You **must**:

- Add or update **tests** for any behavior change.
- Keep PRs **small and focused** (one topic per PR).

---

## How to submit work (mandatory)

### 1. Stay up to date with `main`

Before starting work **and again before opening or updating a PR**:

```bash
git fetch origin
git checkout main
git pull origin main
git checkout your-branch
git rebase origin/main   # or: git merge origin/main
```

**PRs that are behind `main` or conflict with it will not be merged** until rebased and CI is green.

### 2. Branch & commits

1. Fork the repository (external contributors) or branch from `main` (org members).
2. Use a clear branch name: `feat/…`, `fix/…`, `design/…`, `security/…`, `template/…`.
3. Write commit messages in the form `type(scope): summary` (English or French).

### 3. Pull request requirements (strict)

Every PR **must** include:

| Requirement | Details |
| --- | --- |
| **Clear summary** | What changed and **why** (not only what files moved). |
| **Linked issues** | `Fixes #123` or `Relates to #456` when applicable. |
| **Screenshots** | **Mandatory** for any UI/UX change (before/after when relevant). |
| **Demo video** | **Strongly recommended** for new features or non-trivial flows (30–90 s screen recording). |
| **Tests** | List commands run; CI must pass (see below). |
| **Review hygiene** | **Reply to every review comment** as soon as possible; resolve threads or explain why not. |

Incomplete PRs (missing visuals for UI work, no test evidence, or silent review threads) **will be closed or sent back** until fixed.

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) — do not delete its sections.

### 4. Review & merge

- At least one maintainer approval is required.
- **All CI jobs must be green** (lint, tests, build, Gitleaks, Trivy, Semgrep).
- Maintainers merge after rebase on latest `main`.

---

## Development setup

Start infrastructure with Docker first:

```bash
cp .env.example .env
docker compose up -d --build   # or: make up
```

### Frontend (`apps/web`)

Next.js 15 + TypeScript.

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3100
```

Checks before submitting:

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
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements-dev.txt              # runtime deps + ruff + pytest
uvicorn app.main:app --reload --port 8100
```

Checks before submitting:

```bash
ruff format app tests
ruff check app tests
pytest -q
```

Set `TEMPLATES_ROOT` when running tests outside Docker:

```bash
export TEMPLATES_ROOT="$(pwd)/../../data/templates"   # from apps/api
```

### Runtime (`apps/api/runtime`)

In-browser Babel runner. `packages.json` is the single source of truth for the import map, AST allowlist, and Monaco types.

```bash
cd apps/api/runtime
npm ci
node --test tests/
```

### Templates (`data/templates`)

See [Contributing template kits](#contributing-template-kits).

---

## Contributing template kits

Template kits are forkable React starters shown in the Forge gallery. **Designers and developers** can contribute new kits or improve existing ones.

### Folder layout

Each kit lives at `data/templates/<id>/` where `<id>` matches `^[a-z0-9][a-z0-9-]{1,62}$` (example: `aurora-ai`).

```
data/templates/<id>/
├── template.json        # catalog: i18n title/description, tags, hex palette, bootHint
├── DESIGN.md            # design charter (colors, tone, do/don't, image URLs)
├── preview.html         # static gallery thumbnail — no <script> tags
├── index.html
├── package.json         # "name" must equal <id>
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx          # single page — imports from "react" only
    └── index.css        # plain CSS, no @import, uses :root palette vars
```

Overview: [data/templates/README.md](data/templates/README.md) · Full contract: [docs/TEMPLATES.md](docs/TEMPLATES.md) (🇫🇷 [TEMPLATES.fr.md](docs/TEMPLATES.fr.md))

### Key rules (enforced by CI)

| Rule | Why |
| --- | --- |
| `src/App.tsx` imports **only** `"react"` | Kits run in the zero-install Babel browser runner |
| `preview.html` has **no** `<script>` | Gallery thumbnail is pure HTML/CSS |
| `src/index.css` has **no** `@import` | No external fonts/CSS at runtime |
| `template.json` palette uses `#rrggbb` hex | Agent and gallery read consistent tokens |
| `title`, `description`, `bootHint` in **en** + **fr** | Bilingual product |

### Submission workflow

1. Fork / branch from latest `main`.
2. Add or edit `data/templates/<id>/` following the layout above.
3. Register the new `<id>` in `EXPECTED_IDS` (`apps/api/tests/test_templates.py`).
4. Update keyword routing in `apps/api/app/services/templates.py` if the kit targets new topics.
5. Run `cd apps/api && pytest tests/test_templates.py -q`.
6. Open a PR with:
   - **Screenshot** of the gallery card (`preview.html` rendering)
   - **Screenshot or video** of a forked live preview in the builder
   - Branch name `template/<id>` when adding a kit

Use issue template [template_proposal.yml](.github/ISSUE_TEMPLATE/template_proposal.yml) to discuss a kit **before** large design work.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

| Job | What it checks |
| --- | --- |
| **API** | Ruff format + lint, pytest |
| **Web** | ESLint, typecheck, Vitest, production build |
| **Runtime** | Python/JS manifest parity |
| **Docker compose** | Local stack validation |
| **Gitleaks** | Secret scanning |
| **Trivy** | Dependency & image vulnerabilities |
| **Semgrep** | Static analysis (`apps/web`, `apps/api/app`) |

Fix CI failures on your branch before requesting review.

---

## Code style

- **Python:** `ruff` (format + check)
- **TypeScript:** ESLint + `tsc`
- Match existing patterns; avoid drive-by refactors unrelated to your PR.

---

## Getting help

- **Questions & ideas:** open a GitHub Issue using one of the templates
- **Security:** [SECURITY.md](SECURITY.md) — private advisories, or forge@rodiumai.io
- **Code of conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — reports go privately to forge@rodiumai.io
