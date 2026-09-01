<!-- Français accepté / French is welcome -->

## Summary

<!-- What does this PR change? Why? Be specific. -->

## Linked issues

<!-- Fixes #123 · Relates to #456 -->

## Contributor role

- [ ] Designer (UI/UX)
- [ ] Frontend developer
- [ ] Backend developer
- [ ] Cybersecurity / hardening
- [ ] Other: ___

## Sync with `main`

- [ ] I rebased (or merged) on the latest `origin/main` immediately before opening/updating this PR.

## Tests run

- [ ] API: `cd apps/api && ruff format --check app tests && ruff check app tests && pytest -q`
- [ ] Web: `cd apps/web && npm run typecheck && npm test && npm run lint && FORGE_FONT_MODE=fallback npm run build`
- [ ] Runtime (if touched): `cd apps/api/runtime && npm ci && node --test tests/`
- [ ] Templates (if touched): `cd apps/api && pytest tests/test_templates.py -q`

## Screenshots

<!-- **Required** for any UI/UX change. Before/after when relevant. -->

## Demo video

<!-- **Strongly recommended** for new features or non-trivial flows (link to upload or screen recording). -->

## Review checklist

- [ ] PR description is clear and complete.
- [ ] I will **reply to every review comment** promptly.
- [ ] CI is green (lint, tests, Gitleaks, Trivy, Semgrep).
