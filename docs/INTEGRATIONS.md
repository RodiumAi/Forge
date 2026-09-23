# Forge Integrations contract

Integrations are **catalog entries** for third-party embeds (forms, booking, chat, payments, …) shown on `/integrations`. Contributors add a folder under [`data/integrations/`](../data/integrations/); the API scans the filesystem — no DB migration.

## Policy

Only kits that work on a **static** Forge prototype by pasting an official:

- `iframe`, or
- embed `script`, or
- hosted checkout / payment `link`

are accepted (`access` must be `yes`). Rejected for the catalog: partial form-action APIs, payment SDKs that need server verify, Auth/BaaS client SDKs, fetch-only backends.

## Folder layout

```
data/integrations/<id>/
├── integration.json
├── logo.svg
├── guide.en.md
└── guide.fr.md
```

- `<id>` matches `^[a-z0-9][a-z0-9-]{1,62}$` and **must** equal `integration.json` → `id`.
- `access` is only `yes`.
- `methods` must include at least one of `iframe`, `script`, `link`.
- Logos are **vendored** (offline clone). Prefer Simple Icons via `scripts/fetch-integration-logos.mjs`; initials SVG is an acceptable fallback.
- Guides are short Get started docs (EN + FR). No raw `<script>` outside fenced code blocks.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations` | List (`?category=&q=&access=`) |
| `GET` | `/integrations/{id}` | Meta + `guide_md` for locale |
| `GET` | `/integrations/{id}/logo` | Logo file |
| `GET` | `/integrations/{id}/guide` | Raw markdown |

Env: `INTEGRATIONS_ROOT` (default `./data/integrations`; Docker `/data/integrations` or `/app/data/integrations`).

## Chat flow (phase 1)

Users copy the embed from the third-party dashboard and **paste it into Forge chat**. There is no multi-select connector UI yet (phase 2).

## Contributing

See [CONTRIBUTING.md — Contributing integrations](../CONTRIBUTING.md#contributing-integrations). Register new ids in `EXPECTED_IDS` inside `apps/api/tests/test_integrations.py`. CI fails the API job if JSON/MD/logo shape is wrong.

Français: [INTEGRATIONS.fr.md](INTEGRATIONS.fr.md)
