# Forge templates

Les starters forkables vivent ici. Catalogue actuel = **6 démos ThemeWagon** adaptées en Vite + React.

| id | Source | Prompt keywords (auto-suggest) |
|---|---|---|
| `sarab-restaurant` | https://themewagon.github.io/sarab/ | restaurant, resto, menu, food |
| `bloom-shop` | https://themewagon.github.io/bloomtpl/ | ecommerce, boutique, shop, cart |
| `folio-eliott` | https://themewagon.github.io/folio-tailwind/ | portfolio, freelance |
| `tailnext-saas` | https://themewagon.github.io/tailnext/ | saas, pricing |
| `podux-podcast` | https://themewagon.github.io/podux/ | podcast, episode |
| `play-startup` | https://themewagon.github.io/play-astro/ | startup, landing, features |

Images miroir : `_media/themewagon/{slug}/` (manifest + sources).

## Hybrid create

`POST /projects` with a free-text `prompt` (and no `template_id`) runs `suggest_template(prompt)`.
If keywords match a kit, the API forks that template then the agent personalizes it.
Otherwise it scaffolds a blank Vite React app.

## Régénérer

```bash
# re-télécharger les assets (optionnel)
# python scripts/download_themewagon_images.py

python scripts/build_themewagon_templates.py
```

## API

- `GET /templates`
- `GET /templates/{id}/preview`
- `POST /projects` avec `{ "template_id": "sarab-restaurant" }` ou `{ "prompt": "…" }`
