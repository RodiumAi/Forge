# Contrat Intégrations Forge

Les intégrations sont des **entrées de catalogue** pour des embeds tiers (formulaires, RDV, chat, paiements, …) affichées sur `/integrations`. Les contributeurs ajoutent un dossier sous [`data/integrations/`](../data/integrations/) ; l’API lit le filesystem — pas de migration DB.

## Politique

Uniquement des kits qui marchent sur un prototype Forge **statique** en collant un embed officiel :

- `iframe`, ou
- `script` d’embed, ou
- `link` de paiement / checkout hébergé

(`access` doit être `yes`). Hors catalogue : APIs form-action partielles, SDK paiement à verify serveur, SDK Auth/BaaS, backends `fetch` seuls.

## Arborescence

```
data/integrations/<id>/
├── integration.json
├── logo.svg
├── guide.en.md
└── guide.fr.md
```

- `<id>` respecte `^[a-z0-9][a-z0-9-]{1,62}$` et **doit** égaler `integration.json` → `id`.
- `access` = `yes` uniquement.
- `methods` doit inclure au moins `iframe`, `script` ou `link`.
- Logos **vendored** (clone offline). Préférer Simple Icons via `scripts/fetch-integration-logos.mjs`.
- Guides Get started courts (EN + FR). Pas de `<script>` hors blocs de code.

## API

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/integrations` | Liste (`?category=&q=&access=`) |
| `GET` | `/integrations/{id}` | Meta + `guide_md` selon locale |
| `GET` | `/integrations/{id}/logo` | Fichier logo |
| `GET` | `/integrations/{id}/guide` | Markdown brut |

Env : `INTEGRATIONS_ROOT` (défaut `./data/integrations` ; Docker `/data/integrations` ou `/app/data/integrations`).

## Chat (phase 1)

L’utilisateur copie l’embed depuis le dashboard tiers et le **colle dans le chat Forge**. Pas encore d’UI multi-connecteurs (phase 2).

## Contribuer

Voir [CONTRIBUTING.fr.md — Contribuer des intégrations](../CONTRIBUTING.fr.md#contribuer-des-intégrations). Enregistrer les nouveaux ids dans `EXPECTED_IDS` (`apps/api/tests/test_integrations.py`). La CI (job API) refuse les kits JSON/MD/logo non conformes.

English: [INTEGRATIONS.md](INTEGRATIONS.md)
