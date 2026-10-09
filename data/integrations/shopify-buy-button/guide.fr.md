# Shopify Buy Button

Embed Buy Button pour produits Shopify.

**Catégorie :** payments  
**Méthodes :** script  
**Accès :** `yes`

## Ce que ça permet

Shopify Buy Button fournit un embed navigateur à coller dans un site React Forge : en général une iframe, une balise script, ou un petit snippet SDK (script).

## Docs officielles

https://shopify.dev/docs/storefronts/themes/product-merchandising/add-to-cart

## 1. Créer un compte

1. Ouvrez le produit et créez un compte (gratuit ou essai).
2. Créez la ressource à embarquer (formulaire, calendrier, chat, bouton de paiement, carte, …).
3. Ouvrez **Share**, **Embed** ou **Install** et copiez le snippet HTML/JS.

## 2. Exemple d'embed

Remplacez les `YOUR_*` par les valeurs de votre tableau de bord.

```html
<div id="product-component-YOUR_ID"></div>
<script type="text/javascript">
/* Collez ici le snippet Buy Button depuis l'admin Shopify.
   Il charge https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js
   et se monte dans #product-component-YOUR_ID */
</script>
```

## 3. L'ajouter dans Forge

1. Ouvrez Forge → nouveau projet ou chat existant.
2. Collez le snippet ci-dessus dans le prompt (avec fence markdown ou HTML brut).
3. Demandez un emplacement précis, par exemple :

```text
Ajoute cet embed Shopify Buy Button dans une section Contact de la landing.
Conteneur responsive, cohérent avec le design du site.
```

4. Vérifiez la preview live. Itérez dans le chat si hauteur, marges ou thème doivent changer.

## 4. Points d'attention

Le sandbox / CSP de la preview peut bloquer certains scripts tiers. Si le widget échoue, dites-le à l'agent.

Ne collez jamais de clés secrètes (secret / private / webhook) dans le frontend. Les clés publiques et IDs de formulaire sont OK.
