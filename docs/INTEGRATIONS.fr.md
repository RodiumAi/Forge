# Contrat Intégrations Forge

> 🇬🇧 English version: [INTEGRATIONS.md](INTEGRATIONS.md)

Les intégrations sont des **entrées de catalogue** pour des embeds tiers
(formulaires, réservation, chat, paiements, statistiques, cartes, vidéo…)
affichées sur `/integrations`. Les contributeurs ajoutent un dossier sous
[`data/integrations/`](../data/integrations/) ; l'API lit les dossiers à
l'exécution (`apps/api/app/services/integrations.py`), sans changement de base
de données. Le catalogue compte 45 entrées.

## Comment l'agent les utilise

Les sites publiés sont statiques, sans backend Forge derrière : formulaires de
visiteurs, newsletters, réservations et statistiques passent toujours par l'un
de ces embeds, avec l'identifiant de formulaire ou de site de l'utilisateur.

- **Chaque prompt de code** d'un site ou d'une application contient le
  catalogue (`format_integrations_prompt_block`, ajouté par
  `services/prototype_mode.py`) : une ligne par fournisseur, regroupée par
  catégorie, et les règles d'embed (iframes en JSX, widgets script injectés une
  seule fois dans un `useEffect`, jamais d'identifiant de compte inventé : à
  défaut, un emplacement étiqueté et une question en une phrase).
- **Intégrations choisies.** Le menu + du composer ouvre un sélecteur
  (`apps/web/components/builder/IntegrationPicker.tsx`, 5 au plus par message)
  qui ajoute une ligne de marqueur au message, `[Integrations: Nom (id), …]`.
  Pour ces ids, le prompt contient aussi le guide de chacune et l'URL de sa
  documentation (`format_selected_integrations_block`), et l'agent reprend tel
  quel le snippet, l'URL ou l'identifiant collé par l'utilisateur.

## Politique

Uniquement des entrées qui marchent sur un site Forge **statique** en collant un
embed officiel :

- `iframe`, ou
- `script` d'embed, ou
- `link` de paiement / checkout hébergé

(`access` doit valoir `yes`). Refusés : APIs form-action partielles, SDK de
paiement qui exigent une vérification serveur, SDK client Auth/BaaS, backends
accessibles seulement par `fetch`.

## Arborescence

```
data/integrations/<id>/
├── integration.json
├── logo.png          # ou .svg, .jpg : le fichier nommé par "logo"
├── guide.en.md
└── guide.fr.md
```

Le chargeur ignore une entrée (et `test_integrations.py` échoue) quand :

- le nom du dossier ne respecte pas `^[a-z0-9][a-z0-9-]{1,62}$` ou diffère de
  l'`id` de `integration.json` ;
- `access` ne vaut pas `yes` ;
- `categories` est vide ;
- `methods` ne contient ni `iframe`, ni `script`, ni `link` ;
- le fichier de logo ou l'un des deux guides manque.

Le test exige aussi `name` et `docsUrl`, un titre dans chaque guide, et aucun
`<script>` brut hors des blocs de code. Les logos sont stockés dans le dossier
(aucun CDN à l'exécution). La liste complète des champs est dans
[`data/integrations/README.md`](../data/integrations/README.md).

## API

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/integrations` | Liste (`?category=&q=&access=`) |
| `GET` | `/integrations/{id}` | Méta + `guide_md` dans la langue de la requête |
| `GET` | `/integrations/{id}/logo` | Fichier logo |
| `GET` | `/integrations/{id}/guide` | Markdown brut |

`INTEGRATIONS_ROOT` fixe le dossier : `./data/integrations` par défaut ;
`docker-compose.yml` définit `/data/integrations`, l'image API
`/app/data/integrations`.

## Contribuer

Voir [CONTRIBUTING.fr.md, Contribuer des intégrations](../CONTRIBUTING.fr.md#contribuer-des-intégrations).
Enregistrer les nouveaux ids dans `EXPECTED_IDS` (`apps/api/tests/test_integrations.py`)
et lancer `cd apps/api && pytest tests/test_integrations.py -q`. La CI l'exécute
dans le job API.
