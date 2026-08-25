# Forge templates

Les starters forkables vivent ici. Catalogue actuel = **6 démos ThemeWagon** adaptées en Vite + React.

| id | Source |
|---|---|
| `sarab-restaurant` | https://themewagon.github.io/sarab/ |
| `bloom-shop` | https://themewagon.github.io/bloomtpl/ |
| `folio-eliott` | https://themewagon.github.io/folio-tailwind/ |
| `tailnext-saas` | https://themewagon.github.io/tailnext/ |
| `podux-podcast` | https://themewagon.github.io/podux/ |
| `play-startup` | https://themewagon.github.io/play-astro/ |

Images miroir : `_media/themewagon/{slug}/` (manifest + sources).

## Régénérer

```bash
# re-télécharger les assets (optionnel)
# python scripts/download_themewagon_images.py

python scripts/build_themewagon_templates.py
```

## API

- `GET /templates`
- `GET /templates/{id}/preview`
- `POST /projects` avec `{ "template_id": "sarab-restaurant" }`
