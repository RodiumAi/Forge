# Integrations catalog

Embeddable third-party tools shown on `/integrations`. Each kit is a folder under `data/integrations/<id>/`.

**Policy:** only tools that work on a static Forge site by pasting an official **iframe**, **script**, or **payment/checkout link**. No partial kits, no Auth/BaaS SDKs, no form-action / fetch-only APIs.

## Layout

```
data/integrations/<id>/
├── integration.json   # catalog meta (required)
├── logo.svg|png       # local logo (required; no CDN at runtime)
├── guide.en.md        # Get started (required)
└── guide.fr.md        # Get started FR (required)
```

`id` must match `^[a-z0-9][a-z0-9-]{1,62}$` and equal the folder name.

## `integration.json`

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Same as folder name |
| `name` | yes | Display name |
| `categories` | yes | Non-empty list (`forms`, `booking`, `chat`, …) |
| `access` | yes | Must be `yes` (drop-in only) |
| `methods` | yes | At least one of `iframe`, `script`, `link` |
| `docsUrl` | yes | Official embed docs |
| `logo` | yes | Relative file: `logo.svg` or `logo.png` |
| `i18n.en/fr.title` + `blurb` | yes | Bilingual card copy |
| `badge` | no | Optional label (`New`, …) |
| `enabledHint` | no | Reserved for phase 2 |
| `simpleIcon` | no | Slug for `scripts/fetch-integration-logos.mjs` |

## Guides

Markdown Get started with at least one heading. No raw `<script>` tags outside fenced code blocks.

Suggested steps: create account → copy embed → paste in Forge chat → ask the agent to place it.

## Scripts

```bash
# Pull Simple Icons SVGs (v13) when a slug is known
node --use-system-ca scripts/fetch-integration-logos.mjs

# Fill remaining initials with Simple Icons + favicon/PNG CDNs
node --use-system-ca scripts/fetch-missing-integration-logos.mjs
```

## Contract

- English: [docs/INTEGRATIONS.md](../../docs/INTEGRATIONS.md)
- Français: [docs/INTEGRATIONS.fr.md](../../docs/INTEGRATIONS.fr.md)
- CI: `pytest apps/api/tests/test_integrations.py`
