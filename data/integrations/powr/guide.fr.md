# POWR

Formulaires, galeries et plugins via script.

**Catégorie :** widgets  
**Méthodes :** script  
**Accès :** `yes`

## Ce que ça permet

POWR fournit un embed navigateur à coller dans un site React Forge : en général une iframe, une balise script, ou un petit snippet SDK (script).

## Docs officielles

https://www.powr.io/help

## 1. Créer un compte

1. Ouvrez le produit et créez un compte (gratuit ou essai).
2. Créez la ressource à embarquer (formulaire, calendrier, chat, bouton de paiement, carte, …).
3. Ouvrez **Share**, **Embed** ou **Install** et copiez le snippet HTML/JS.

## 2. Exemple d'embed

Remplacez les `YOUR_*` par les valeurs de votre tableau de bord.

```html
<!-- Collez ici le snippet officiel POWR -->
<!-- Formes typiques : <iframe src="…"> ou <script src="…"> -->
<iframe
  src="https://example.com/embed/YOUR_ID"
  style="width:100%;min-height:480px;border:0;"
  title="POWR"
></iframe>
```

## 3. L'ajouter dans Forge

1. Ouvrez Forge → nouveau projet ou chat existant.
2. Collez le snippet ci-dessus dans le prompt (avec fence markdown ou HTML brut).
3. Demandez un emplacement précis, par exemple :

```text
Ajoute cet embed POWR dans une section Contact de la landing.
Conteneur responsive, cohérent avec le design du site.
```

4. Vérifiez la preview live. Itérez dans le chat si hauteur, marges ou thème doivent changer.

## 4. Points d'attention

Le sandbox / CSP de la preview peut bloquer certains scripts tiers. Si le widget échoue, dites-le à l'agent.

Ne collez jamais de clés secrètes (secret / private / webhook) dans le frontend. Les clés publiques et IDs de formulaire sont OK.
