# Gumroad

Checkout overlay pour produits numériques.

**Catégorie :** payments  
**Méthodes :** script, link  
**Accès :** `yes`

## Ce que ça permet

Gumroad fournit un embed navigateur à coller dans un site React Forge : en général une iframe, une balise script, ou un petit snippet SDK (script, link).

## Docs officielles

https://help.gumroad.com/article/68-overlay-checkout

## 1. Créer un compte

1. Ouvrez le produit et créez un compte (gratuit ou essai).
2. Créez la ressource à embarquer (formulaire, calendrier, chat, bouton de paiement, carte, …).
3. Ouvrez **Share**, **Embed** ou **Install** et copiez le snippet HTML/JS.

## 2. Exemple d'embed

Remplacez les `YOUR_*` par les valeurs de votre tableau de bord.

```html
<script src="https://gumroad.com/js/gumroad.js"></script>
<a class="gumroad-button" href="https://gumroad.com/l/YOUR_PRODUCT">Acheter</a>
```

## 3. L'ajouter dans Forge

1. Ouvrez Forge → nouveau projet ou chat existant.
2. Collez le snippet ci-dessus dans le prompt (avec fence markdown ou HTML brut).
3. Demandez un emplacement précis, par exemple :

```text
Ajoute cet embed Gumroad dans une section Contact de la landing.
Conteneur responsive, cohérent avec le design du site.
```

4. Vérifiez la preview live. Itérez dans le chat si hauteur, marges ou thème doivent changer.

## 4. Points d'attention

Le sandbox / CSP de la preview peut bloquer certains scripts tiers. Si le widget échoue, dites-le à l'agent.

Ne collez jamais de clés secrètes (secret / private / webhook) dans le frontend. Les clés publiques et IDs de formulaire sont OK.
