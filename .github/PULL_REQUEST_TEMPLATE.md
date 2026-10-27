<!-- Français accepté / French is welcome. Open this PR against `dev`, not `main`. -->

## Summary

<!-- What does this PR change? Why? Be specific. -->

## Linked issues

<!-- Fixes #123 · Relates to #456 -->

## Project kind

- [ ] Site / App (`web`, `mobile`)
- [ ] Slides (`slides`)
- [ ] Codelab (`codelab`)
- [ ] Design system (`design_system`)
- [ ] Not specific to a kind

## Contributor role

- [ ] Designer (UI/UX)
- [ ] Template kit author (`data/templates/`)
- [ ] Integration kit author (`data/integrations/`)
- [ ] Frontend developer
- [ ] Backend developer
- [ ] Cybersecurity / hardening
- [ ] Other: ___

## Sync with `dev`

- [ ] This PR targets `dev`.
- [ ] I rebased (or merged) on the latest `origin/dev` right before opening or updating this PR.

## Checks run

CI does not run on pull requests to `dev`: tick what you ran locally (details in CONTRIBUTING.md, section "Checks (CI)").

- [ ] API: `cd apps/api && ruff check app tests && ruff format --check app tests && ENVIRONMENT=test pytest -q` (with `npm ci` done in `apps/api/runtime` and `apps/api/runtime/deck`)
- [ ] Web: `cd apps/web && npm run lint && npm run typecheck && npm test && DOCKER_BUILD=1 FORGE_FONT_MODE=fallback NEXT_PUBLIC_API_URL=http://localhost:8100 npm run build`
- [ ] Runtime (if touched): `npm test` in `apps/api/runtime` and `apps/api/runtime/deck`, then `python infra/ci/check_manifest_parity.py` from the repository root
- [ ] Python dependencies (if touched): `make lock`, input and lock committed together
- [ ] Docker compose (if touched): `docker compose config --quiet`
- [ ] Templates (if touched): `cd apps/api && pytest tests/test_templates.py -q` plus the test of the kind (`test_template_slides.py`, `test_template_codelab.py` or `test_template_design_systems.py`); new id registered in `tests/test_templates.py`
- [ ] Integrations (if touched): `cd apps/api && pytest tests/test_integrations.py -q`; new id registered in `EXPECTED_IDS`
- [ ] Slides, codelabs or design systems: tried in the app with the matching `FORGE_KIND_*_ENABLED=true`

## Screenshots

<!-- **Required** for any UI/UX change. Before/after when relevant. For a template kit: the gallery card and a project forked from it, in its editor. -->

## Demo video

<!-- **Strongly recommended** for new features or non-trivial flows (link to an upload or screen recording). -->

## Review checklist

- [ ] PR description is clear and complete.
- [ ] I will **reply to every review comment** promptly.
- [ ] No secret, key or personal data in the diff (Gitleaks, Trivy and Semgrep run once the PR is merged into `dev`).
