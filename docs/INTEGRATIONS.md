# Forge Integrations contract

> 🇫🇷 Version française : [INTEGRATIONS.fr.md](INTEGRATIONS.fr.md)

Integrations are **catalog entries** for third-party embeds (forms, booking,
chat, payments, analytics, maps, video…) shown on `/integrations`. Contributors
add a folder under [`data/integrations/`](../data/integrations/); the API reads
the folders at runtime (`apps/api/app/services/integrations.py`), with no
database change. The catalog holds 45 entries.

## How the agent uses them

Published sites are static, with no Forge backend behind them: visitor forms,
newsletters, bookings and analytics are always one of these embeds, wired with
the user's own form or site id.

- **Every code prompt** of a site or app carries the catalog
  (`format_integrations_prompt_block`, added by `services/prototype_mode.py`):
  one line per provider grouped by category, and the embed rules (iframes as
  JSX, script widgets injected once in a `useEffect`, never an invented account
  id: without it, a labeled placeholder and a one-sentence question).
- **Picked integrations.** The composer's + menu opens a picker
  (`apps/web/components/builder/IntegrationPicker.tsx`, up to 5 per message)
  that adds a marker line to the message, `[Integrations: Name (id), …]`. For
  those ids the prompt also carries each guide and its docs URL
  (`format_selected_integrations_block`), and the agent uses the snippet, URL or
  id the user pasted as is.

## Policy

Only entries that work on a **static** Forge site by pasting an official:

- `iframe`, or
- embed `script`, or
- hosted checkout / payment `link`

are accepted (`access` must be `yes`). Rejected: partial form-action APIs,
payment SDKs that need server verification, Auth/BaaS client SDKs, fetch-only
backends.

## Folder layout

```
data/integrations/<id>/
├── integration.json
├── logo.png          # or .svg, .jpg: the file named by "logo"
├── guide.en.md
└── guide.fr.md
```

The loader skips an entry (and `test_integrations.py` fails) when:

- the folder name does not match `^[a-z0-9][a-z0-9-]{1,62}$` or differs from
  `integration.json` `id`;
- `access` is not `yes`;
- `categories` is empty;
- `methods` has none of `iframe`, `script`, `link`;
- the logo file or one of the two guides is missing.

The test also requires `name` and `docsUrl`, a heading in each guide, and no raw
`<script>` outside fenced code blocks. Logos are stored in the folder (no CDN at
runtime). The full field list is in
[`data/integrations/README.md`](../data/integrations/README.md).

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations` | List (`?category=&q=&access=`) |
| `GET` | `/integrations/{id}` | Meta + `guide_md` for the request locale |
| `GET` | `/integrations/{id}/logo` | Logo file |
| `GET` | `/integrations/{id}/guide` | Raw Markdown |

`INTEGRATIONS_ROOT` sets the folder: default `./data/integrations`;
`docker-compose.yml` sets `/data/integrations`, the API image
`/app/data/integrations`.

## Contributing

See [CONTRIBUTING.md, Contributing integrations](../CONTRIBUTING.md#contributing-integrations).
Register new ids in `EXPECTED_IDS` inside `apps/api/tests/test_integrations.py`
and run `cd apps/api && pytest tests/test_integrations.py -q`. CI runs it in
the API job.
