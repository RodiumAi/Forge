# RodiumAi Sites — Orchestration des modèles et économie du contexte

Version 2.0. Document d'implémentation. Compagnon de `rodiumai-sites-backend-spec.md` et `rodiumai-sites-local-dev.md`.

**Changement majeur en v2.0 :** roster mono-fournisseur Google Gemini. Supprime la fragmentation de cache multi-fournisseurs, le routeur OpenAI, et la gestion à deux voies. Réduit la surface d'implémentation d'environ 30 % sans perdre de capacité.

---

## 0. Position du problème

L'utilisateur ne choisit pas son modèle. Il décrit une intention, le système décide. Cette décision optimise une seule grandeur : **le RODI dépensé par tâche réussie**, pas le RODI dépensé par appel.

Un modèle dix fois moins cher qui exige quatre allers-retours au lieu d'un coûte plus cher, prend quatre fois plus de temps, et fait partir l'utilisateur.

Trois leviers, par ordre d'impact réel :

| Levier                         | Gain typique | Effort                                |
| ------------------------------ | ------------ | ------------------------------------- |
| **Réduire le contexte envoyé** | 5x à 30x     | Élevé, mais c'est là que tout se joue |
| **Router vers le bon palier**  | 3x à 8x      | Moyen                                 |
| **Batch API et caching**       | 1,5x à 3x    | Faible, à faire tôt                   |

La section 5 est le cœur du document.

---

## 1. Principes

1. **Un seul fournisseur : Google Gemini.** Trois modèles texte, deux modèles image. Tout ajout hors Gemini doit être justifié par une mesure, pas par une intuition.
2. **Un fournisseur de secours déclaré mais inactif**, pour ne pas dépendre d'un point de défaillance unique. Voir 2.4.
3. **Le catalogue vit en base, jamais dans le code.**
4. **Le routeur ne nomme jamais un modèle.** Il classe la tâche. Une table déterministe fait la correspondance.
5. **L'escalade est bornée** à quatre niveaux, puis arrêt et message à l'utilisateur.
6. **Tout appel passe par `api.rodiumai.io`.** Le builder consomme son propre gateway.
7. **Aucun changement de routage sans évaluation en shadow.** Voir section 11.
8. **Les prix de ce document sont datés du 24 août 2026** et doivent être revérifiés contre la page tarifaire de Google. Le catalogue en base est la source de vérité.

---

## 2. Le roster

### 2.1 Les trois modèles texte

| Palier        | Slug                           | Prix in / out par million                             | Contexte | Sortie max | Rôle                                                                     |
| ------------- | ------------------------------ | ----------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------ |
| **Léger**     | `google/gemini-3.1-flash-lite` | 0,25 / 1,50                                           | 1 M      | 64 k       | Routage, résumés, micro-tâches, éditions triviales, assemblage           |
| **Principal** | `google/gemini-3.7-flash`      | **0,75 / 3,75** jusqu'au 31/12/2026, puis 1,50 / 7,50 | 1 M      | 64 k       | Génération de code, sections, corrections, vision. 80 à 85 % des appels. |
| **Escalade**  | `google/gemini-3.1-pro`        | 2 / 12, **et 4 / 18 au-delà de 200 k**                | 1 M      | 64 k       | Uniquement après deux échecs, ou architecture initiale complexe          |

Trois paliers suffisent. Le rapport de prix entre le léger et l'escalade est de 8 à l'entrée et de 8 à la sortie, ce qui donne assez d'amplitude pour que le routage ait un sens réel.

### 2.2 Les deux modèles image

| Rôle     | Slug                            | Tarification                                                                                                                                            |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primaire | `google/gemini-3.1-flash-image` | 747 tokens (0,045 $) en 512 px, 1 120 tokens (0,067 $) en 1K, 1 680 tokens (0,101 $) en 2K. Plus **1 120 tokens facturés par image fournie en entrée**. |
| Qualité  | `google/gemini-3-pro-image`     | 1 120 tokens (0,134 $) en 1K et 2K, 2 000 tokens (0,24 $) en 4K. Plus 560 tokens par image d'entrée.                                                    |

Le modèle Pro Image ne s'utilise qu'à la publication, jamais en itération. Voir section 8.

### 2.3 Ce que le mono-fournisseur élimine

C'est le vrai bénéfice de ce choix, plus grand que le delta de prix.

| Supprimé                                                    | Pourquoi ça compte                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fragmentation du cache entre fournisseurs                   | Un seul namespace de cache. La couche système est écrite une fois par session, réutilisée par les trois paliers. |
| Gestion à deux voies et adhérence de session                | Toute la logique la plus subtile du routage disparaît.                                                           |
| Trois SDK, trois authentifications, trois systèmes de quota | Une SDK, une clé, un quota.                                                                                      |
| Trois pages tarifaires à surveiller                         | Une.                                                                                                             |
| Trois modes de panne distincts                              | Un.                                                                                                              |
| Normalisation des formats de tool-calling                   | Aucune.                                                                                                          |

Sur une équipe de deux personnes, cette réduction de surface vaut plus que quelques points de pourcentage sur la facture.

### 2.4 Secours fournisseur, inactif

`openai/gpt-5.6-terra` (2,00 / 12,00, contexte 1 M) est déclaré au catalogue avec `status = 'standby'` **dès le premier jour**. Il n'est jamais routé nominalement.

Activation automatique quand l'API Gemini renvoie des 5xx ou des 429 pendant plus de 60 secondes consécutives, sur au moins 5 requêtes.

```python
class ProviderHealth:
    def is_degraded(self, provider: str) -> bool:
        w = self.window(provider, seconds=60)
        return w.count >= 5 and (w.error_rate > 0.5 or w.p95_latency_ms > 30_000)
```

Coût d'implémentation : environ deux heures. Un healthcheck, une ligne au catalogue, un mapping de classe vers Terra. Tu ne l'appelleras peut-être jamais, mais le jour où Gemini a un incident régional tu ne perds pas la journée.

Un prompt système écrit pour Gemini fonctionne sur Terra sans réécriture. Ce n'est pas vrai dans l'autre sens pour tous les fournisseurs, mais ça l'est pour ce couple.

### 2.5 Deux limites à connaître

**Gemini 3.7 Flash décroche sur l'agentique longue.** Il obtient 85,8 % sur Terminal-Bench 2.1 mais tombe à 14,9 % sur la variante 3.0, plus difficile. En clair : excellent sur les tâches courtes et bien cadrées, fragile sur les enchaînements multi-étapes complexes.

Ça ne te gêne pas au démarrage, parce que ton protocole de génération par section (section 6) découpe précisément les tâches longues en tâches courtes. C'est une raison de plus d'implémenter ce protocole tôt.

Quand la classe `code.fix.hard` deviendra fréquente, l'escalade sur Gemini 3.1 Pro peut ne pas suffire. C'est à ce moment, et avec des mesures, que la question d'un second fournisseur se posera.

**Le knowledge cutoff est mars 2026.** Sans importance ici : ton manifeste de paquets est figé et injecté dans le prompt système. Le modèle n'a pas à deviner quelles bibliothèques existent, tu les lui donnes avec leurs versions exactes.

---

## 3. Taxonomie des tâches

Le routage opère sur des **classes de tâche**, pas sur le texte de l'utilisateur. Liste fermée.

| Classe             | Description                                          | Entrée typique  | Sortie typique |
| ------------------ | ---------------------------------------------------- | --------------- | -------------- |
| `intent.classify`  | Déterminer la classe de la demande                   | 400 tok         | 40 tok         |
| `plan.scaffold`    | Plan de création initiale d'un site                  | 8 k             | 1,5 k          |
| `plan.feature`     | Plan d'une fonctionnalité sur projet existant        | 12 k            | 800 tok        |
| `code.scaffold`    | Génération initiale multi-fichiers                   | 10 k            | 8 k            |
| `code.section`     | Génération d'une section isolée                      | 3 k             | 1,2 k          |
| `code.assemble`    | Composition du fichier de page à partir des sections | 2 k             | 400 tok        |
| `code.edit.small`  | 1 fichier, moins de 30 lignes                        | 6 k             | 150 tok        |
| `code.edit.medium` | 1 à 3 fichiers, refactor local                       | 12 k            | 1,5 k          |
| `code.edit.large`  | 4 fichiers et plus, changement transversal           | 25 k            | 4 k            |
| `code.fix.build`   | Correction d'une erreur de compilation               | 8 k             | 400 tok        |
| `code.fix.runtime` | Correction d'une erreur d'exécution capturée         | 10 k            | 600 tok        |
| `code.fix.hard`    | Échec après deux tentatives                          | 30 k            | 3 k            |
| `schema.design`    | Collections, champs, policies                        | 6 k             | 1,5 k          |
| `schema.migrate`   | Évolution d'un schéma existant                       | 8 k             | 800 tok        |
| `vision.describe`  | Décrire une capture ou une maquette                  | image + 500 tok | 800 tok        |
| `vision.to_code`   | Reproduire une maquette en composants                | image + 4 k     | 5 k            |
| `vision.diff`      | Comparer un rendu à une intention                    | 2 images + 1 k  | 400 tok        |
| `image.generate`   | Produire un visuel pour le site                      | prompt          | 1 image        |
| `text.copy`        | Rédaction de contenu du site                         | 2 k             | 1 k            |
| `text.summarize`   | Compaction de conversation, résumé de fichier        | 15 k            | 500 tok        |
| `text.micro`       | Nom de fichier, titre, message de commit, slug       | 500 tok         | 30 tok         |
| `security.scan`    | Revue agentique des policies et du code              | 20 k            | 2 k            |
| `coherence.pass`   | Vérification de cohérence après assemblage           | 6 k             | 300 tok        |

---

## 4. Table de routage

| Classe             | Primaire        | Escalade 1  | Escalade 2 | Batch              |
| ------------------ | --------------- | ----------- | ---------- | ------------------ |
| `intent.classify`  | 3.1-flash-lite  | —           | —          | non                |
| `plan.scaffold`    | 3.7-flash       | 3.1-pro     | —          | non                |
| `plan.feature`     | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.scaffold`    | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.section`     | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.assemble`    | 3.1-flash-lite  | 3.7-flash   | —          | non                |
| `code.edit.small`  | 3.1-flash-lite  | 3.7-flash   | 3.1-pro    | non                |
| `code.edit.medium` | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.edit.large`  | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.fix.build`   | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.fix.runtime` | 3.7-flash       | 3.1-pro     | —          | non                |
| `code.fix.hard`    | 3.1-pro         | —           | —          | non                |
| `schema.design`    | 3.7-flash       | 3.1-pro     | —          | non                |
| `schema.migrate`   | 3.1-flash-lite  | 3.7-flash   | —          | non                |
| `vision.describe`  | 3.7-flash       | —           | —          | non                |
| `vision.to_code`   | 3.7-flash       | 3.1-pro     | —          | non                |
| `vision.diff`      | 3.1-flash-lite  | 3.7-flash   | —          | non                |
| `image.generate`   | 3.1-flash-image | 3-pro-image | —          | oui (préchauffage) |
| `text.copy`        | 3.1-flash-lite  | 3.7-flash   | —          | non                |
| `text.summarize`   | 3.1-flash-lite  | —           | —          | **oui**            |
| `text.micro`       | 3.1-flash-lite  | —           | —          | **oui**            |
| `security.scan`    | 3.7-flash       | 3.1-pro     | —          | **oui**            |
| `coherence.pass`   | 3.1-flash-lite  | —           | —          | non                |

Répartition visée en volume : Flash-Lite 45 %, Flash 3.7 52 %, Pro moins de 3 %.
Répartition attendue en coût : Flash 3.7 environ 78 %, Pro 14 %, Flash-Lite 8 %.

### Modificateurs de plan

| Plan | Effet                                                                    |
| ---- | ------------------------------------------------------------------------ |
| Free | Escalade limitée au niveau 1. Gemini 3.1 Pro inaccessible.               |
| Pro  | Table nominale complète.                                                 |
| Team | Escalade jusqu'au niveau 2 partout, `code.scaffold` démarre sur 3.1 Pro. |

L'utilisateur ne voit jamais ces noms. L'interface affiche au maximum un niveau d'effort.

### 4.1 Le Batch API, levier immédiat

Google propose un endpoint batch à moitié prix, qui **se cumule avec le tarif promotionnel**. Sur Gemini 3.7 Flash, le batch revient aujourd'hui à 0,375 / 1,875 par million.

Détail qui compte : quand le tarif standard doublera au 1er janvier 2027, le batch représentera 25 % du tarif nominal au lieu de 50 % aujourd'hui. L'avantage relatif grandit, il ne diminue pas.

Trois classes doivent y passer dès le premier jour, parce qu'aucun utilisateur n'attend le résultat :

- `security.scan`, déclenché à la publication, résultat consultable quelques minutes plus tard
- `text.summarize` pour la compaction de conversations anciennes
- `text.micro` en lot, quand plusieurs éléments sont à nommer

Ajouter plus tard : le préchauffage d'images pour les templates, et le rejeu du corpus d'évaluation, qui coûte deux fois moins cher en batch.

### 4.2 La falaise des 200 k sur Gemini 3.1 Pro

Attention, ce n'est pas un tarif progressif. Selon la documentation Google Cloud, **si le contexte d'entrée dépasse 200 000 tokens, tous les tokens, entrée comme sortie, sont facturés au tarif long contexte.** Un appel à 201 000 tokens coûte donc le double d'un appel à 199 000, pas 0,5 % de plus.

Conséquence directe sur le routeur :

```python
LONG_CONTEXT_CLIFF = 200_000

def guard_pro_cliff(route: Route, ctx_estimate: int) -> Route:
    if route.model != "google/gemini-3.1-pro":
        return route
    # Marge de 12 % pour couvrir l'erreur d'estimation du tokenizer
    if ctx_estimate > LONG_CONTEXT_CLIFF * 0.88:
        # Rester sous la falaise: réduire le contexte plutôt que payer double
        return route.with_context_reduction(target=LONG_CONTEXT_CLIFF * 0.85)
    return route
```

Réduire le contexte est presque toujours préférable à franchir la falaise. Un projet de 60 fichiers n'atteint jamais 200 k avec la discipline de la section 5. Si tu y arrives, c'est un symptôme, pas une contrainte.

Flash et Flash-Lite ne sont pas concernés : leur tarif reste plat sur tout le million.

---

## 5. Économie du contexte

C'est le cœur du système.

### 5.1 L'input domine

Un tour typique d'édition envoie 40 000 tokens d'entrée et produit 200 tokens de sortie. Sur Gemini 3.7 Flash, cela fait 0,030 dollar d'entrée contre 0,00075 de sortie. **L'entrée représente 97,5 % de la facture.**

Chaque token d'entrée envoyé inutilement est payé à chaque tour. Un fichier de 1 200 tokens laissé dans le contexte pendant 15 tours coûte 18 000 tokens facturés.

### 5.2 Le contexte en cinq couches

L'ordre est **immuable**. Le préfixe stable doit être identique octet pour octet d'un appel à l'autre, sinon le cache est invalidé.

```
┌─ Couche 1 — SYSTÈME (stable) ───────────────────── 6 000 à 9 000 tokens
│  Identité de l'agent, règles de génération,
│  manifeste des paquets autorisés avec versions exactes,
│  conventions de code, format des diffs,
│  catalogue des composants shadcn disponibles
├─ Couche 2 — PROJET (semi-stable) ───────────────── 2 000 à 5 000 tokens
│  Design tokens du site, KNOWLEDGE.md,
│  arbre de fichiers en squelettes, schéma des collections
├─ Couche 3 — SÉLECTION (volatile) ───────────────── 1 000 à 6 000 tokens
│  1 à 5 fichiers pertinents, en entier
├─ Couche 4 — CONVERSATION (compactée) ───────────── 500 à 3 000 tokens
│  3 derniers tours en entier, avant ça un résumé
└─ Couche 5 — INSTRUCTION ──────────────────────────── 50 à 300 tokens
```

**Avantage du mono-fournisseur :** les couches 1 et 2 sont partagées entre les trois paliers. Un cache écrit lors d'un appel Flash-Lite est réutilisable par un appel Flash 3.7 puis par une escalade sur Pro. C'est exactement ce qui était impossible avec un roster multi-fournisseurs.

Erreurs qui invalident le cache, à interdire par revue de code :

- Un horodatage, un identifiant de requête ou un compteur dans la couche 1 ou 2
- Un ordre de fichiers non déterministe dans l'arbre (toujours trier)
- Une injection de la date du jour dans le prompt système
- Un `join()` sur un `set` Python, dont l'ordre varie entre processus

### 5.3 Caching Gemini

Deux mécanismes, à ne pas confondre.

**Cache implicite.** Automatique sur les préfixes répétés, sans configuration ni coût de stockage. Fonctionne bien tant que la couche 1 est stable et que les appels sont rapprochés. C'est le mode par défaut, à utiliser dès le premier jour.

**Cache explicite (context caching).** Tu crées un objet de cache, tu le références, tu paies un coût de stockage par heure en plus du tarif réduit à la lecture. Le rabais annoncé par Google est de l'ordre de 80 à 90 % sur le tarif standard. Sur Gemini 3.1 Pro, l'entrée cachée descend à 0,20 dollar par million contre 2,00.

Règle d'engagement : **cache implicite au jalon 1, cache explicite seulement si la mesure montre un `cache_hit_ratio` inférieur à 60 %.** Le cache explicite ajoute un cycle de vie à gérer, une invalidation à orchestrer, et un coût de stockage qui court même quand la session est abandonnée. Ne l'introduis pas avant d'avoir la preuve qu'il te faut.

### 5.4 Squelettes de fichiers

Ne jamais envoyer l'intégralité du projet. Le squelette est généré côté serveur par un parseur AST, sans appel de modèle :

```
src/components/ProductCard.tsx  (142 lignes)
  export ProductCard(props: { product: Product; onAdd: (id: string) => void })
  imports: @/lib/api, @/components/ui/card, lucide-react
  uses: useState, formatPrice

src/pages/Shop.tsx  (218 lignes)
  export default Shop()
  imports: @/components/ProductCard, @tanstack/react-query
  data: collection "products"
```

Environ 40 tokens par fichier contre 1 200 pour le contenu complet. Sur un projet de 40 fichiers : 1 600 tokens au lieu de 48 000. **Facteur 30.**

### 5.5 Sélection des fichiers

Pas d'embeddings au départ. À 60 fichiers maximum par projet, trois signaux lexicaux suffisent et coûtent zéro.

```python
def select_files(query: str, project: Project, k: int = 4) -> list[File]:
    scores = defaultdict(float)

    # 1. Correspondance lexicale sur les symboles et le chemin
    for f in project.files:
        scores[f.path] += 3.0 * bm25(query, f.symbol_index)
        scores[f.path] += 1.5 * bm25(query, f.path)

    # 2. Voisinage dans le graphe d'imports
    seeds = [p for p, s in scores.items() if s > THRESHOLD]
    for p in seeds:
        for neighbor in project.import_graph.neighbors(p, depth=1):
            scores[neighbor] += 1.0

    # 3. Récence: fichiers touchés dans les 3 derniers tours
    for p in project.recently_edited(turns=3):
        scores[p] += 2.5

    forced = ["src/index.css", "tailwind.config.ts"]
    top = sorted(scores.items(), key=lambda x: -x[1])[:k]
    return [project.get(p) for p, _ in top] + [project.get(p) for p in forced]
```

Passer aux embeddings seulement si la mesure montre un taux de sélection incorrecte supérieur à 15 %.

### 5.6 Édition en diff, jamais réécriture

Format bloc de recherche et remplacement, strictement :

```
<<<<<<< SEARCH src/components/Hero.tsx
      <button className="bg-blue-600 text-white px-4 py-2 rounded">
=======
      <button className="bg-orange-500 text-white px-4 py-2 rounded-lg">
>>>>>>> REPLACE
```

Règles d'application :

1. Le bloc SEARCH doit matcher exactement, une seule fois. Sinon, échec explicite.
2. En cas d'échec de match, une seule nouvelle tentative avec le fichier complet en contexte.
3. Deuxième échec : escalade.
4. Jamais de match approximatif ni de normalisation d'espaces. Un patch appliqué au mauvais endroit est pire qu'un échec.

Gain : 150 tokens de sortie contre 1 400 pour une réécriture complète. Sur Gemini 3.7 Flash, 0,00056 contre 0,00525 dollar. **Facteur 9 en sortie.**

### 5.7 Compaction de conversation

Quand la couche 4 dépasse 4 000 tokens, résumer tous les tours sauf les trois derniers, sur Flash-Lite, en batch quand la latence le permet.

```
Résume cette conversation entre un utilisateur et un agent de génération de site.
Conserve impérativement:
- les décisions prises (couleurs, structure, noms de collections)
- les contraintes exprimées par l'utilisateur
- les fichiers créés ou modifiés, avec leur rôle
- les problèmes rencontrés et leur résolution
Ignore: les formulations de politesse, les tâtonnements, les diffs déjà appliqués.
Maximum 400 tokens.
```

Coût sur Flash-Lite : 12 000 tokens d'entrée à 0,25 plus 400 de sortie à 1,50, soit environ 0,0036 dollar. En batch : 0,0018. Économie sur chaque tour suivant avec Flash 3.7 : environ 0,006 dollar. **Amorti au premier ou deuxième tour suivant.**

### 5.8 Récapitulatif chiffré

Un tour d'édition simple au tour numéro 8 d'une session.

| Approche                                                           | Contexte               | Sortie | Modèle         | Coût     |
| ------------------------------------------------------------------ | ---------------------- | ------ | -------------- | -------- |
| Naïve : tout le projet, toute la conversation, réécriture complète | 49 000                 | 1 400  | 3.7 Flash      | 0,0420 $ |
| Squelettes + sélection + compaction, réécriture complète           | 8 000                  | 1 400  | 3.7 Flash      | 0,0113 $ |
| Idem + diff                                                        | 8 000                  | 150    | 3.7 Flash      | 0,0066 $ |
| Idem + cache implicite chaud sur les couches 1 et 2                | 8 000 (7 000 en cache) | 150    | 3.7 Flash      | 0,0019 $ |
| Idem + routage `code.edit.small` sur Flash-Lite                    | 8 000 (7 000 en cache) | 150    | 3.1 Flash-Lite | 0,0008 $ |

**Facteur 53 entre le premier et le dernier.** Le routage seul, appliqué à l'approche naïve, aurait donné un facteur 3. Le contexte fait le reste, et de loin.

L'écart entre le premier et le dernier est moins spectaculaire que dans la v1.1, parce que le modèle de départ est déjà six fois moins cher que Sonnet 4.6. En valeur absolue, la session complète coûte pourtant nettement moins. Voir section 13.

---

## 6. Génération par section

Pour toute page dépassant environ 200 lignes, ne jamais faire un seul appel monolithique. Ce protocole est particulièrement important avec ce roster : il transforme une tâche agentique longue, sur laquelle Gemini 3.7 Flash est faible, en une série de tâches courtes, sur lesquelles il est excellent.

### 6.1 Protocole

**Phase 1, plan.** Un appel Flash 3.7 produit un contrat de sections en JSON.

```json
{
  "page": "src/pages/Landing.tsx",
  "sections": [
    {
      "id": "hero",
      "component": "Hero",
      "role": "Accroche principale avec titre, sous-titre et bouton d'action",
      "props": {
        "title": "string",
        "subtitle": "string",
        "ctaLabel": "string"
      },
      "needs": ["design_tokens"]
    },
    {
      "id": "features",
      "component": "FeatureGrid",
      "role": "Grille de 3 arguments produit avec icône",
      "props": {
        "items": "Array<{icon: string; title: string; body: string}>"
      },
      "needs": ["design_tokens", "lucide_icons"]
    },
    {
      "id": "pricing",
      "component": "PricingTable",
      "role": "Trois offres avec mise en avant de l'offre du milieu",
      "props": { "plans": "Plan[]" },
      "needs": ["design_tokens", "collection:plans"]
    }
  ]
}
```

**Phase 2, génération parallèle sur Flash 3.7.** N appels en parallèle. Chaque appel reçoit uniquement :

- Couche 1 système, partagée donc chaude dès le deuxième appel
- Les design tokens du projet
- Son propre contrat de section
- Les squelettes des sections voisines
- Rien d'autre

Contexte par appel : 3 000 à 4 000 tokens au lieu de 25 000. Gemini 3.7 Flash tourne autour de 340 tokens par seconde selon les mesures d'Artificial Analysis, ce qui rend le parallélisme particulièrement efficace.

**Phase 3, assemblage sur Flash-Lite.** Le fichier de page qui importe et compose les sections. Purement mécanique, classe `code.assemble`.

**Phase 4, cohérence sur Flash-Lite.** Classe `coherence.pass`. Vérifie la régularité des espacements verticaux et la monotonie de la hiérarchie typographique.

### 6.2 Gains

|                            | Monolithique         | Par section (5 sections)      |
| -------------------------- | -------------------- | ----------------------------- |
| Modèle                     | 3.7 Flash            | 3.7 Flash + Flash-Lite        |
| Contexte total facturé     | 25 000               | 5 × 3 500 = 17 500            |
| Contexte non caché         | 25 000               | 8 000 (le 1er) + 4 × 500      |
| Sortie                     | 6 000                | 5 × 1 200 + 400               |
| Coût                       | 0,0413 $             | 0,0292 $                      |
| Latence perçue             | 40 s séquentiels     | 9 s (parallèle, 340 tok/s)    |
| Régénération d'une section | tout refaire         | 1 appel à 0,0055 $            |
| Robustesse                 | 1 échec = tout perdu | 1 échec = 1 section à refaire |

Les deux dernières lignes comptent plus que le coût. « Refais juste le hero » devient un appel à moins d'un centime. Et un échec ne détruit pas le travail réussi.

### 6.3 Contraintes de cohérence

Trois garde-fous contre l'incohérence visuelle :

1. **Design tokens obligatoires et injectés à l'identique** dans chaque appel. Les couleurs, rayons, espacements et polices sont des variables CSS déjà définies, la section les consomme, elle ne les invente pas.
2. **Interdiction des valeurs arbitraires Tailwind.** Le validateur AST rejette `text-[#3a7bd5]` ou `p-[13px]`. Seules les classes de l'échelle sont acceptées.
3. **Passe de cohérence** après l'assemblage.

---

## 7. Vision, lecture d'images

Toute la vision passe par Gemini 3.7 Flash, sauf `vision.diff` qui va sur Flash-Lite. Escalade sur 3.1 Pro uniquement pour `vision.to_code`.

### 7.1 Le coût caché

Une image de 1024 × 1024 pèse entre 1 100 et 1 600 tokens. Une capture de page complète en 1920 × 3000 peut dépasser 5 000 tokens.

Repère chiffré chez Google : Gemini 3.1 Flash Image facture 1 120 tokens par image fournie en entrée, et Gemini 3 Pro Image en facture 560.

### 7.2 Prétraitement obligatoire

Avant tout envoi, côté serveur, sans appel de modèle :

```python
def prepare_image(raw: bytes, task: str) -> bytes:
    img = Image.open(BytesIO(raw))

    max_dim = {
        "vision.describe": 768,
        "vision.to_code":  1152,
        "vision.diff":     640,
    }[task]
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg

    out = BytesIO()
    img.save(out, "WEBP", quality=82, method=4)
    return out.getvalue()
```

Une capture de 1920 × 3000 réduite à 1152 de côté long passe d'environ 5 200 à 1 400 tokens. **Facteur 3,7 pour une perte de lisibilité nulle sur une maquette web.**

### 7.3 Découpage des captures longues

Pour une page dépassant un ratio de 1:2,5, découper verticalement en bandes avec 10 % de recouvrement, et traiter chaque bande comme une section. Cela s'aligne avec le protocole de la section 6.

### 7.4 Ne jamais garder les images dans l'historique

Une image envoyée au tour 3 ne doit pas être renvoyée au tour 4. Après traitement, elle est remplacée dans l'historique par sa description textuelle, qui pèse 800 tokens au lieu de 1 400 et ne se dégrade pas.

```python
history.append({
    "role": "user",
    "content": f"[Image fournie: {description}]\n{user_text}"
})
```

Les trois modèles texte du roster gèrent la vision, donc contrairement à un roster incluant DeepSeek, garder une image n'empêche pas le routage. Ça reste néanmoins du gaspillage pur : l'image est refacturée à chaque tour suivant.

---

## 8. Génération d'images

### 8.1 D'abord, ne pas générer

Par ordre de préférence :

1. **Rien.** Un dégradé CSS, une forme SVG, une composition typographique. Coût zéro, poids zéro, rendu net sur tout écran.
2. **Icônes.** `lucide-react` est dans le manifeste. Coût zéro.
3. **Banque d'images libre.** Un index pré-constitué de photographies libres de droits, catégorisées, servi depuis ton propre CDN. Coût marginal zéro.
4. **Génération**, uniquement quand le visuel est spécifique au métier de l'utilisateur.

Cette hiérarchie n'est pas de l'avarice, c'est de la qualité. Une landing page avec quatre photos génériques générées par IA a l'air moins professionnelle qu'une page typographique propre.

### 8.2 Protocole en deux passes

**Passe 1, itération.** `gemini-3.1-flash-image` en 512 px, soit 747 tokens de sortie et environ 0,045 dollar. L'utilisateur voit la composition, valide la direction, itère.

**Passe 2, publication.** Uniquement pour les images encore présentes dans le site final. `gemini-3.1-flash-image` en 1K (0,067 $) par défaut, `gemini-3-pro-image` en 1K (0,134 $) pour les visuels de première importance comme un hero ou un logo.

Sur un site où l'utilisateur essaie douze images et en garde quatre : 12 × 0,045 + 4 × 0,067 = 0,81 dollar. En générant tout directement en 1K : 12 × 0,067 = 0,80. **L'économie est ici marginale**, contrairement à un fournisseur ayant un vrai palier « low ».

Conséquence : sur ce roster, le vrai levier n'est pas la qualité de la passe 1 mais **la limitation du nombre de générations**. Deux mesures concrètes :

- Plafonner à 3 générations par emplacement d'image et par session avant d'exiger une confirmation
- Toujours proposer une alternative sans génération dans l'interface : dégradé, forme SVG, ou photo de la banque libre

### 8.3 Attention à l'entrée facturée

Une opération d'édition qui envoie une image en référence paie 1 120 tokens d'entrée en plus de la sortie. Ne jamais envoyer deux images de référence si une seule suffit. Et ne jamais réenvoyer l'image précédente pour une simple variation de prompt : régénérer à partir du prompt seul.

### 8.4 Déduplication et cache

Clé de cache : `sha256(model + prompt_normalisé + seed + taille)`. Deux utilisateurs qui demandent la même chose avec le même prompt normalisé reçoivent la même image depuis R2, sans nouvel appel.

Ne pas dédupliquer les prompts contenant un nom propre, une marque ou plus de 40 caractères de spécificité.

### 8.5 Sécurité

Chaque prompt passe par un filtre avant envoi : refus des demandes de personnes réelles nommées, de marques, de contenu explicite, et de contenu violent. Un refus retourne un message clair et propose une alternative descriptive, jamais une erreur technique.

---

## 9. Le routeur

### 9.1 Ce que le routeur décide, et ce qu'il ne décide pas

`gemini-3.1-flash-lite` **ne choisit pas un modèle**. Il produit une classification et une estimation de complexité. Une table SQL fait la correspondance.

Raison : si le routeur nomme directement un modèle, tu ne peux plus changer ton roster sans réécrire son prompt, le modèle dérive vers ses préférences, et tu ne peux plus faire d'A/B sur la table de routage. Le routeur produit un fait, la table produit une décision.

**Contrat de sortie, strictement en JSON :**

```json
{
  "class": "code.edit.medium",
  "files_estimate": 2,
  "complexity": "medium",
  "needs_vision": false,
  "confidence": 0.86,
  "reason": "modification du panier, touche le composant et le hook"
}
```

Utiliser le mode de sortie structurée de l'API Gemini plutôt que d'espérer un JSON valide. Toute sortie non conforme au schéma déclenche un repli sur `code.edit.medium`, la classe médiane, jamais une erreur visible.

**Prompt du routeur, environ 400 tokens, stable donc caché :**

```
Tu classes une demande utilisateur adressée à un générateur de sites React + Vite.
Tu ne réponds jamais à la demande. Tu ne proposes jamais de code.

Classes autorisées:
plan.scaffold, plan.feature, code.scaffold, code.section, code.edit.small,
code.edit.medium, code.edit.large, code.fix.build, code.fix.runtime,
schema.design, schema.migrate, vision.to_code, image.generate,
text.copy, security.scan

Règles:
- code.edit.small si le changement touche 1 fichier et moins de 30 lignes
- code.edit.large si 4 fichiers ou plus, ou si un contrat de données change
- code.fix.* uniquement si un message d'erreur est fourni
- En cas de doute entre deux classes, choisis la plus coûteuse

Contexte projet: {file_count} fichiers, {collection_count} collections,
tour {turn_index} de la session.

Réponds uniquement avec l'objet JSON, sans texte autour.
```

### 9.2 Le routeur ne tourne pas à chaque requête

Trois filtres avant de l'appeler.

**Filtre 1, cache de routage.** Clé `route:{sha256(intent_normalisé + project_state_hash)}`, TTL 3600 secondes dans Redis.

**Filtre 2, heuristiques, coût zéro.** Couvrent environ 55 % des cas restants.

```python
HEURISTICS = [
    (r"^(change|modifie|remplace|mets|passe)\b.{0,80}(couleur|taille|texte|marge|police|padding)",
     ("code.edit.small", 1, "trivial")),
    (r"\b(erreur|error|ne (marche|fonctionne) pas|bug|cassé|crash|blanc)\b",
     ("code.fix.runtime", 1, "medium")),
    (r"^(crée|génère|fais|construis)\b.{0,60}(site|page|app|landing|boutique|dashboard)",
     ("code.scaffold", 12, "hard")),
    (r"\b(table|collection|base de données|champ|schéma|enregistrement)\b",
     ("schema.design", 0, "medium")),
    (r"^(ajoute|rajoute)\b.{0,60}(section|bloc|composant|encart)",
     ("code.section", 2, "medium")),
    (r"^(écris|rédige|génère)\b.{0,50}(texte|contenu|description|slogan)",
     ("text.copy", 0, "trivial")),
]
```

**Filtre 3, présence d'une image.** Une image en entrée force `vision.*` sans appel de routeur.

Le routeur LLM ne tourne donc que sur environ 20 % des tours. À 400 tokens d'entrée et 40 de sortie sur Flash-Lite, cela représente environ 0,00016 dollar par appel, soit un coût négligeable même à un million de tours mensuels.

### 9.3 Règles de surcharge

Appliquées après la table, dans cet ordre :

```python
def apply_overrides(route: Route, s: RouteSignals) -> Route:
    # 1. Échecs répétés: escalade forcée
    if s.failure_count_in_run >= 1:
        route = route.escalate(s.failure_count_in_run)

    # 2. Falaise des 200 k sur Pro
    route = guard_pro_cliff(route, s.context_estimate)

    # 3. Premier tour d'un nouveau projet: jamais en dessous de Flash 3.7
    if s.is_first_turn:
        route = route.at_least("google/gemini-3.7-flash")

    # 4. Solde bas: plafonner à Flash 3.7, ne jamais couper brutalement
    if s.rodi_balance < LOW_BALANCE_THRESHOLD:
        route = route.cap_at("google/gemini-3.7-flash")

    # 5. Panne fournisseur: bascule sur le secours déclaré
    if health.is_degraded("google"):
        route = route.failover()

    return route
```

La règle 3 est délibérée. Le premier prompt d'un utilisateur détermine s'il reste.

Toute la logique d'adhérence de voie de la v1.1 a disparu : avec un seul fournisseur, changer de palier ne coûte rien en cache.

---

## 10. Escalade, budget et échec

### 10.1 Escalade

```
Tentative 1  modèle primaire, contexte nominal
     │ échec de build ou de validation
     ▼
Tentative 2  même modèle, contexte augmenté du stderr et du fichier complet
     │ échec
     ▼
Tentative 3  escalade_1, contexte élargi aux voisins du graphe d'imports
     │ échec
     ▼
Tentative 4  escalade_2 si elle existe, sinon escalade_1 avec contexte complet
     │ échec
     ▼
ARRÊT. Message à l'utilisateur, rollback au dernier état vert,
       proposition de reformuler. Le run est marqué failed.
```

Règles fermes :

- Le budget RODI du run est vérifié **avant chaque escalade**.
- Chaque escalade est enregistrée avec la classe, le modèle, la raison et le nombre de tokens.
- Un taux d'escalade supérieur à 20 % sur une classe signifie que le modèle primaire est mal choisi.
- Après un arrêt, le run suivant sur la même tâche démarre directement au niveau atteint.
- Une escalade vers Pro doit vérifier la falaise des 200 k avant de partir.

### 10.2 Budget par run

| Plan | Budget par tour | Budget par session | Plafond mensuel dur |
| ---- | --------------- | ------------------ | ------------------- |
| Free | 0,05 $          | 0,80 $             | selon le solde RODI |
| Pro  | 0,35 $          | 8,00 $             | selon le solde RODI |
| Team | 1,20 $          | 35,00 $            | selon le solde RODI |

Ces budgets sont environ 40 % plus bas que dans la v1.1, parce que le roster est moins cher. À revoir au 1er janvier 2027 quand le tarif de Flash 3.7 doublera.

Le compteur est tenu dans Redis, clé `budget:run:{run_id}`, incrémenté après chaque réponse avec le coût réel calculé depuis les compteurs de tokens retournés par le gateway. Ne jamais estimer, toujours mesurer.

Quand 80 % du budget d'un tour est consommé, le routeur bascule sur Flash-Lite pour les appels restants et le note dans les logs. Quand 100 % est atteint, l'exécution s'arrête proprement avec un état cohérent, jamais au milieu d'une application de patch.

---

## 11. Mesure et évaluation

### 11.1 Métriques obligatoires

| Métrique                     | Définition                                             | Objectif                               |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------- |
| `first_pass_success_rate`    | Part des tâches réussies sans escalade                 | > 80 % sur `code.edit.*`               |
| `escalation_rate`            | Part des runs ayant escaladé au moins une fois         | < 15 %                                 |
| `turns_to_completion`        | Tours utilisateur jusqu'à satisfaction                 | < 1,6 médiane                          |
| `rodi_per_completed_task`    | La métrique reine                                      | à minimiser sous contrainte des autres |
| `cache_hit_ratio`            | Tokens d'entrée servis par le cache                    | > 60 %                                 |
| `context_tokens_p50` / `p95` | Distribution de la taille de contexte                  | p95 < 25 000                           |
| `pro_cliff_crossings`        | Appels Pro au-delà de 200 k                            | 0                                      |
| `batch_share_of_eligible`    | Part des classes éligibles réellement passées en batch | > 90 %                                 |
| `abandon_rate`               | Sessions quittées après un échec                       | < 5 %                                  |

Segmenter chaque métrique par classe de tâche et par modèle.

### 11.2 Le jeu d'évaluation

Constituer un corpus de 200 tâches réelles anonymisées, couvrant toutes les classes, avec pour chacune :

- L'état initial du projet
- L'instruction utilisateur
- Un critère de réussite vérifiable automatiquement : le build passe, tel sélecteur existe dans le DOM rendu, telle valeur CSS est appliquée, telle policy refuse tel accès

Ce corpus grandit avec chaque incident de production. Le rejeu passe par le Batch API, donc à moitié prix.

### 11.3 Procédure de changement de routage

1. Rejouer les 200 tâches sur la configuration actuelle, enregistrer la ligne de base.
2. Rejouer sur la configuration candidate.
3. Comparer `first_pass_success_rate` par classe. Une baisse de plus de 5 points sur une classe bloque le changement.
4. Comparer `rodi_per_completed_task`. Un gain inférieur à 15 % ne justifie pas le risque.
5. Déployer sur 5 % du trafic pendant 72 heures.
6. Généraliser ou revenir en arrière.

Coût du rejeu complet avec ce roster, en batch : environ 3 à 5 dollars. Assez bon marché pour le faire toutes les deux semaines.

**Trois évaluations à programmer :**

- **Semaine 6.** Comparer Gemini 3.6 Flash et 3.7 Flash. Les deux sont actuellement au même tarif promotionnel de 0,75 / 3,75. Si 3.6 s'avère suffisant sur ton corpus, tu gagnes une option de repli au moment où les tarifs changeront.
- **Semaine 8.** Comparer Flash-Lite et Flash 3.7 sur `code.edit.small` et `code.section`. C'est le seul arbitrage de routage qui déplace vraiment la facture.
- **Avant le 30 novembre 2026.** Réévaluer tout le roster au tarif de 2027, soit 1,50 / 7,50 pour Flash 3.7. À ce prix, l'écart avec Gemini 3.1 Pro se réduit à un facteur 1,6 seulement, et la table de routage doit être reprise **avant** le 1er janvier, pas après.

### 11.4 Surveillance des modèles

Les fournisseurs modifient leurs modèles sans changer l'identifiant. Faire tourner un sous-ensemble de 20 tâches du corpus tous les jours, en batch, et alerter si `first_pass_success_rate` chute de plus de 10 points sur sept jours glissants. Coût quotidien inférieur à 0,30 dollar.

Cette surveillance est **plus critique en mono-fournisseur** : une régression chez Google affecte 100 % de ton trafic, sans dilution.

---

## 12. Schéma de données

```sql
CREATE TABLE model_catalog (
  slug              TEXT PRIMARY KEY,
  provider          TEXT NOT NULL,
  role              TEXT NOT NULL,            -- light | main | escalate | image | standby
  price_in_usd_per_m    NUMERIC(10,4) NOT NULL,
  price_out_usd_per_m   NUMERIC(10,4) NOT NULL,
  price_cache_hit_per_m NUMERIC(10,4),
  long_context_threshold INT,                 -- NULL si tarif plat
  price_long_in     NUMERIC(10,4),
  price_long_out    NUMERIC(10,4),
  supports_batch    BOOLEAN NOT NULL DEFAULT false,
  batch_discount    NUMERIC(3,2) DEFAULT 0.50,
  context_window    INT NOT NULL,
  max_output        INT NOT NULL,
  supports_vision   BOOLEAN NOT NULL DEFAULT false,
  supports_tools    BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'active',
  price_valid_until DATE,
  price_after_in    NUMERIC(10,4),
  price_after_out   NUMERIC(10,4),
  verified_at       DATE NOT NULL,
  notes             TEXT
);

INSERT INTO model_catalog
 (slug, provider, role, price_in_usd_per_m, price_out_usd_per_m, price_cache_hit_per_m,
  long_context_threshold, price_long_in, price_long_out, supports_batch, context_window,
  max_output, supports_vision, status, price_valid_until, price_after_in, price_after_out,
  verified_at, notes)
VALUES
 ('google/gemini-3.1-flash-lite','google','light',0.25,1.50,NULL,NULL,NULL,NULL,true,1000000,
  64000,true,'active',NULL,NULL,NULL,'2026-08-24','Tarif plat sur tout le contexte'),
 ('google/gemini-3.7-flash','google','main',0.75,3.75,NULL,NULL,NULL,NULL,true,1000000,
  64000,true,'active','2026-12-31',1.50,7.50,'2026-08-24','Promo jusqu au 31/12/2026'),
 ('google/gemini-3.1-pro','google','escalate',2.00,12.00,0.20,200000,4.00,18.00,true,1000000,
  64000,true,'active',NULL,NULL,NULL,'2026-08-24','FALAISE: au-dela de 200k tout est facture au tarif long'),
 ('google/gemini-3.1-flash-image','google','image',0,0,NULL,NULL,NULL,NULL,true,0,
  0,false,'active',NULL,NULL,NULL,'2026-08-24','1120 tokens par image en entree'),
 ('google/gemini-3-pro-image','google','image',0,0,NULL,NULL,NULL,NULL,true,0,
  0,false,'active',NULL,NULL,NULL,'2026-08-24','560 tokens par image en entree'),
 ('openai/gpt-5.6-terra','openai','standby',2.00,12.00,NULL,NULL,NULL,NULL,true,1000000,
  64000,true,'standby',NULL,NULL,NULL,'2026-08-24','Secours fournisseur uniquement');

CREATE TABLE task_route (
  task_class     TEXT NOT NULL,
  plan_tier      TEXT NOT NULL,
  primary_slug   TEXT NOT NULL REFERENCES model_catalog(slug),
  escalate_1     TEXT REFERENCES model_catalog(slug),
  escalate_2     TEXT REFERENCES model_catalog(slug),
  use_batch      BOOLEAN NOT NULL DEFAULT false,
  max_context    INT NOT NULL,
  max_output     INT NOT NULL,
  temperature    NUMERIC(3,2) NOT NULL DEFAULT 0.2,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     TEXT,
  PRIMARY KEY (task_class, plan_tier)
);

CREATE TABLE model_call_log (
  ts                TIMESTAMPTZ NOT NULL,
  run_id            UUID NOT NULL,
  site_id           UUID NOT NULL,
  turn_index        INT NOT NULL,
  task_class        TEXT NOT NULL,
  model_slug        TEXT NOT NULL,
  routed_by         TEXT NOT NULL,   -- cache | heuristic | llm | forced | failover
  is_batch          BOOLEAN NOT NULL DEFAULT false,
  escalation_level  SMALLINT NOT NULL DEFAULT 0,
  tokens_in         INT NOT NULL,
  tokens_cached     INT NOT NULL DEFAULT 0,
  tokens_out        INT NOT NULL,
  crossed_cliff     BOOLEAN NOT NULL DEFAULT false,
  context_layers    JSONB NOT NULL,
  latency_ms        INT NOT NULL,
  outcome           TEXT NOT NULL,
  usd_cost          NUMERIC(12,6) NOT NULL,
  rodi_cost         NUMERIC(12,6) NOT NULL
) PARTITION BY RANGE (ts);
```

Les champs `is_batch` et `crossed_cliff` sont spécifiques à ce roster. Le second doit rester à `false` en permanence : toute occurrence à `true` est un bug de garde, pas une décision.

Un cron hebdomadaire alerte 30 jours avant l'échéance de `price_valid_until`.

---

## 13. Chiffrage d'une session type

Création d'une boutique en ligne, douze tours, deux images, une correction d'erreur, une maquette fournie.

| Tour    | Classe                     | Modèle                 | Contexte (dont caché) | Sortie    | Coût          |
| ------- | -------------------------- | ---------------------- | --------------------- | --------- | ------------- |
| 1       | `plan.scaffold`            | 3.7 Flash              | 9 000 (0)             | 1 500     | 0,0124 $      |
| 1       | `code.scaffold`            | 3.7 Flash              | 11 000 (8 000)        | 8 000     | 0,0323 $      |
| 2       | `image.generate` ×2 512 px | 3.1 Flash Image        | —                     | 2 images  | 0,0900 $      |
| 3       | `code.edit.small`          | 3.1 Flash-Lite         | 7 500 (7 000)         | 180       | 0,0006 $      |
| 4       | `code.section` ×3          | 3.7 Flash              | 3 × 3 500 (3 × 3 000) | 3 × 1 200 | 0,0170 $      |
| 4       | `code.assemble`            | 3.1 Flash-Lite         | 2 000 (1 500)         | 400       | 0,0008 $      |
| 5       | `code.fix.build`           | 3.7 Flash              | 8 200 (7 000)         | 400       | 0,0024 $      |
| 6       | `schema.design`            | 3.7 Flash              | 7 000 (6 000)         | 1 500     | 0,0064 $      |
| 7       | `code.edit.medium`         | 3.7 Flash              | 10 000 (7 000)        | 1 400     | 0,0075 $      |
| 8       | `text.summarize`           | 3.1 Flash-Lite (batch) | 12 000 (0)            | 400       | 0,0018 $      |
| 8       | `code.edit.small`          | 3.1 Flash-Lite         | 6 800 (6 000)         | 150       | 0,0004 $      |
| 9       | `vision.to_code`           | 3.7 Flash              | 6 800 (3 000) + image | 3 200     | 0,0149 $      |
| 10      | `code.edit.small`          | 3.1 Flash-Lite         | 7 000 (6 200)         | 200       | 0,0005 $      |
| 11      | `text.copy`                | 3.1 Flash-Lite         | 3 000 (2 500)         | 900       | 0,0016 $      |
| 12      | `security.scan`            | 3.7 Flash (batch)      | 18 000 (8 000)        | 1 800     | 0,0075 $      |
| —       | `intent.classify` ×8       | 3.1 Flash-Lite         | 400 chacun            | 40 chacun | 0,0013 $      |
| publish | `image.generate` ×2 en 1K  | 3.1 Flash Image        | —                     | 2 images  | 0,1340 $      |
|         |                            |                        |                       | **Total** | **≈ 0,347 $** |

Quatre observations importantes :

1. **Les images représentent 65 % de la facture** (0,224 sur 0,347), pour 4 générations sur 25 appels. Le texte coûte 0,123 dollar au total. C'est l'inversion complète du roster v1.1, où Sonnet dominait. **Le poste à surveiller ici n'est pas le code, c'est l'image.** D'où les plafonds de la section 8.2 et la hiérarchie « ne pas générer d'abord ».

2. **Le coût texte seul est de 0,123 dollar**, contre 0,35 avec le roster Claude 4.6 de la v1.1. Facteur 2,8 sur la partie code, pour une capacité comparable sur ce type de tâche selon les benchmarks de développement web.

3. Sans discipline de contexte ni routage, la même session dépasse 1,50 dollar sur le texte seul. **Facteur 12.**

4. **Au 1er janvier 2027**, la partie texte passe d'environ 0,123 à 0,225 dollar, soit +83 % sur cette ligne et +29 % sur le total. À budgéter dès maintenant.

À 0,35 dollar de coût réel, une tarification autour de 3 à 5 RODI pour cette session laisse une marge saine.

---

## 14. Phasage d'implémentation

Aligné sur les quatre jalons produit.

**Jalon 1, semaines 1 à 4. Un seul modèle.**
`gemini-3.7-flash` partout, sans routeur, sans escalade, sans génération d'images. Manifeste de runtime, prompt système, validateur AST d'imports, preview `esbuild-wasm`, Sites Gateway avec `data`, `auth` et `storage` en managed, moteur de policies complet.

**Instrumenter `model_call_log` dès la semaine 1**, même avec un seul modèle. Sans ces données, le jalon 3 est impossible à décider.

**Jalon 2, semaines 5 et 6. La discipline de contexte.**
Squelettes AST, sélection de fichiers, diffs stricts, compaction, les cinq couches avec ordre immuable, cache implicite. Toujours un seul modèle. C'est ici que se joue le facteur 12.

**Jalon 3, semaines 7 et 8. La publication et le routage.**
Build worker, R2, worker Cloudflare, wildcard. En parallèle : catalogue en base, table de routage à trois paliers, cascade cache puis heuristiques puis Flash-Lite, escalade bornée, budget par run, Batch API sur les trois classes éligibles, secours Terra en standby.

**Jalon 4, semaines 9 à 11. Le reste.**
Génération par section, images en deux passes, vision, connectors externes, corpus d'évaluation et harnais de rejeu.

L'ordre est délibéré. Implémenter le routage avant la discipline de contexte optimise le mauvais paramètre et rend les mesures ininterprétables.

---

## 15. Erreurs à ne pas commettre

1. **Router avant d'avoir maîtrisé le contexte.** Le gain est cinq à trente fois plus grand du côté du contexte.
2. **Mettre un horodatage dans le prompt système.** Invalide tout le cache, silencieusement, à chaque appel.
3. **Laisser un appel Pro franchir la barre des 200 000 tokens.** Le coût double d'un coup, entrée et sortie comprises.
4. **Laisser le routeur nommer un modèle.** Il classe, la table décide.
5. **Oublier le Batch API.** Trois classes y sont éligibles dès le premier jour, à moitié prix, sans aucune contrepartie.
6. **Générer des images sans plafond.** Sur ce roster, l'image représente les deux tiers de la facture d'une session type.
7. **Renvoyer une image de référence pour une simple variation de prompt.** 1 120 tokens d'entrée pour rien.
8. **Exposer les noms de modèles à l'utilisateur.** Crée une attente contractuelle.
9. **Coder le catalogue en dur.**
10. **Mesurer le coût par appel** au lieu du coût par tâche réussie.
11. **Oublier la date du 31 décembre 2026.** Le tarif double le lendemain, la facture texte augmente de 83 %.
12. **Ne pas déclarer le secours fournisseur.** En mono-fournisseur, une panne Google est une panne totale.
13. **Faire du match approximatif sur les diffs.**
14. **Changer le routage sans rejeu du corpus.**

---

## 16. À vérifier avant implémentation

| Élément                                      | Pourquoi                                                                                                                                                                                                                                                        | Où                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Disponibilité régionale de l'API Gemini      | Des restrictions régionales existent sur certains produits Gemini, dont une exclusion consommateur touchant le Nigeria. À confirmer que l'**API** est bien disponible sans restriction pour tes marchés (Togo, Bénin, Ghana, Nigeria, Côte d'Ivoire, Cameroun). | Documentation Google, conditions régionales |
| Vertex AI ou AI Studio                       | Vertex permet de consommer tes crédits Google Cloud. À arbitrer avant d'écrire le client.                                                                                                                                                                       | Console Google Cloud                        |
| Tarif de cache de Gemini 3.7 Flash           | Non publié explicitement dans mes sources. Le rabais annoncé est de 80 à 90 %.                                                                                                                                                                                  | Page tarifaire Google                       |
| Grille exacte de Gemini 3.1 Flash Image      | Les paliers 512 / 1K / 2K et le coût d'entrée de 1 120 tokens sont à confirmer                                                                                                                                                                                  | Documentation Vertex AI                     |
| Existence du Batch API sur les modèles image | Le préchauffage de templates en dépend                                                                                                                                                                                                                          | Documentation Google                        |
| Fenêtre de sortie max                        | 64 k retenu ici. Détermine si `code.scaffold` tient en un appel.                                                                                                                                                                                                | Fiche modèle Gemini                         |
| Quotas et limites de débit par projet        | Un seul fournisseur signifie un seul plafond de débit. À vérifier avant le premier pic.                                                                                                                                                                         | Console Google Cloud                        |

Le premier point est le plus important et le plus urgent : une restriction régionale sur l'API rendrait tout ce document caduc pour ton marché. À vérifier avant d'écrire la première ligne.
