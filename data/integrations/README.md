# Integrations catalog

Embeddable third-party tools shown on `/integrations` (45 entries). Each entry
is a folder under `data/integrations/<id>/`.

**Policy:** only tools that work on a static Forge site by pasting an official
**iframe**, **script**, or **payment/checkout link**. No partial kits, no
Auth/BaaS SDKs, no form-action / fetch-only APIs.

## Layout

```
data/integrations/<id>/
├── integration.json   # catalog meta (required)
├── logo.png           # local logo named by "logo" (required; .png, .svg or .jpg, no CDN at runtime)
├── guide.en.md        # Get started (required)
└── guide.fr.md        # Get started FR (required)
```

`id` must match `^[a-z0-9][a-z0-9-]{1,62}$` and equal the folder name.

## `integration.json`

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Same as folder name |
| `name` | yes | Display name |
| `categories` | yes | Non-empty list (`forms`, `booking`, `chat`, …); the first one groups the entry in the agent prompt |
| `access` | yes | Must be `yes` (drop-in only) |
| `methods` | yes | At least one of `iframe`, `script`, `link` |
| `docsUrl` | yes | Official embed docs |
| `logo` | yes | Relative file in the folder (defaults to `logo.svg` when absent) |
| `i18n.en` / `i18n.fr` | yes | `title` and `blurb` of the card |
| `badge` | no | Optional label (`New`, …) |
| `enabledHint` | no | Returned by the API as `enabled_hint`; unused by the agent |
| `simpleIcon` | no | Simple Icons slug of the logo; not read by the API |

## Guides

Markdown Get started with at least one heading. No raw `<script>` tags outside
fenced code blocks. When a user picks the integration in the composer, the
agent receives this guide (first 6000 characters).

Suggested steps: create an account → copy the embed → paste it in the Forge
chat (or pick the integration from the + menu) → ask the agent to place it.

## Contract

- English: [docs/INTEGRATIONS.md](../../docs/INTEGRATIONS.md)
- Français: [docs/INTEGRATIONS.fr.md](../../docs/INTEGRATIONS.fr.md)
- Tests: `cd apps/api && pytest tests/test_integrations.py -q`
