# Open PR triage (Forge) — 2026-10-05

Maintainer snapshot of open PRs on [RodiumAi/Forge](https://github.com/RodiumAi/Forge).
**This is a verdict only** — no automatic merge/close from this docs refresh.

| PR | Title | Verdict | Why |
| --- | --- | --- | --- |
| [#126](https://github.com/RodiumAi/Forge/pull/126) | brace-expansion | **Merge** | Security patch, CI green |
| [#124](https://github.com/RodiumAi/Forge/pull/124) | dompurify 3.4.16 | **Merge** | Patch, CI green |
| [#115](https://github.com/RodiumAi/Forge/pull/115) | web minor/patch group | **Merge** | Grouped minors, CI green |
| [#113](https://github.com/RodiumAi/Forge/pull/113) | @babel/standalone patch | **Merge** | Runtime patch; Trivy often flaky |
| [#112](https://github.com/RodiumAi/Forge/pull/112) | upload-artifact v7 | **Merge** | Actions major, CI green |
| [#111](https://github.com/RodiumAi/Forge/pull/111) | setup-python v7 | **Merge** | Actions major, CI green |
| [#117](https://github.com/RodiumAi/Forge/pull/117) | vitest 5 | **Review then merge** | Major test runner; CI green — smoke locally first |
| [#119](https://github.com/RodiumAi/Forge/pull/119) | firebase 12 | **Review then merge** | Major SDK; CI green — re-check Google popup/redirect |
| [#114](https://github.com/RodiumAi/Forge/pull/114) | lucide-react 0.468→1.48 (runtime) | **Cautious** | Major icons in runtime; smoke preview before merge |
| [#123](https://github.com/RodiumAi/Forge/pull/123) | docs INTEGRATIONS_ROOT | **Absorb into docs** | Docs-only, behind `main`; content folded into this refresh |
| [#128](https://github.com/RodiumAi/Forge/pull/128) | api minor/patch group | **Do not merge as-is** | API job fails: `uv pip compile` + lockfile `git diff --exit-code` |
| [#127](https://github.com/RodiumAi/Forge/pull/127) | pyjwt 2.15 | **Do not merge as-is** | Same lockfile drift |
| [#122](https://github.com/RodiumAi/Forge/pull/122) | bcrypt 5.0 | **Do not merge as-is** | Major + lockfile fail; treat as dedicated upgrade |
| [#121](https://github.com/RodiumAi/Forge/pull/121) | redis-py 8.1 | **Do not merge as-is** | Major + lockfile fail |
| [#118](https://github.com/RodiumAi/Forge/pull/118) | TypeScript 7 | **Defer / close** | Major TS; Web CI red — too early |
| [#116](https://github.com/RodiumAi/Forge/pull/116) | eslint-config-next 16 | **Defer / close** | Pulls Next 16 while product is still Next 15; Web CI red |

## Suggested order

1. Merge the green patch batch: **#126, #124, #115, #113, #112, #111**.
2. Smoke then merge **#117 / #119 / #114**.
3. Close or ignore **#116 / #118** until a planned Next/TS upgrade.
4. For **#121 / #122 / #127 / #128**: `@dependabot recreate` after a clean `uv pip compile` (or a manual lockfile PR).
5. Close **#123** once this docs refresh lands (content absorbed).
