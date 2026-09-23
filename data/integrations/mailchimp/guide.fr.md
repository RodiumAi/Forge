# Mailchimp

Formulaires d’inscription embarqués.

**Catégorie :** email  
**Méthodes :** script, iframe  
**Accès :** `yes`

## Ce que ça permet

Mailchimp fournit un embed navigateur à coller dans un site React Forge : en général une iframe, une balise script, ou un petit snippet SDK (script, iframe).

## Docs officielles

https://mailchimp.com/help/add-a-signup-form-to-your-website/

## 1. Créer un compte

1. Ouvrez le produit et créez un compte (gratuit ou essai).
2. Créez la ressource à embarquer (formulaire, calendrier, chat, bouton de paiement, carte, …).
3. Ouvrez **Share**, **Embed** ou **Install** et copiez le snippet HTML/JS.

## 2. Exemple d'embed

Remplacez les `YOUR_*` par les valeurs de votre tableau de bord.

```html
<!-- Collez le HTML exporté depuis Mailchimp Audience → Signup forms → Embedded forms -->
<div id="mc_embed_signup">
  <form action="https://YOUR_LIST.usX.list-manage.com/subscribe/post?u=...&id=..."
        method="post" id="mc-embedded-subscribe-form">
    <input type="email" name="EMAIL" required placeholder="Email" />
    <button type="submit">S'abonner</button>
  </form>
</div>
```

## 3. L'ajouter dans Forge

1. Ouvrez Forge → nouveau projet ou chat existant.
2. Collez le snippet ci-dessus dans le prompt (avec fence markdown ou HTML brut).
3. Demandez un emplacement précis, par exemple :

```text
Ajoute cet embed Mailchimp dans une section Contact de la landing.
Conteneur responsive, cohérent avec le design du site.
```

4. Vérifiez la preview live. Itérez dans le chat si hauteur, marges ou thème doivent changer.

## 4. Points d'attention

Le sandbox / CSP de la preview peut bloquer certains scripts tiers. Si le widget échoue, dites-le à l'agent.

Ne collez jamais de clés secrètes (secret / private / webhook) dans le frontend. Les clés publiques et IDs de formulaire sont OK.
