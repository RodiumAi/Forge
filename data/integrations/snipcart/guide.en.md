# Snipcart

JS cart for static / JAMstack sites.

**Category:** payments  
**Methods:** script  
**Access:** `yes`

## What you get

Snipcart ships a browser embed you can drop into a Forge React site: typically an iframe, a script tag, or a small SDK snippet (script).

## Official docs

https://docs.snipcart.com/v3/setup/installation

## 1. Create an account

1. Open the product and create a free (or trial) account.
2. Create the resource you want to embed (form, calendar, chat widget, payment button, map, …).
3. Open **Share**, **Embed**, or **Install** and copy the HTML/JS snippet.

## 2. Example embed

Replace `YOUR_*` placeholders with values from your dashboard.

```html
<script async src="https://cdn.snipcart.com/themes/v3.2.0/default/snipcart.js"></script>
<link rel="stylesheet" href="https://cdn.snipcart.com/themes/v3.2.0/default/snipcart.css" />
<div hidden id="snipcart" data-api-key="YOUR_PUBLIC_API_KEY"></div>

<button
  class="snipcart-add-item"
  data-item-id="sku-1"
  data-item-price="29.00"
  data-item-url="/"
  data-item-name="Product"
>Add to cart</button>
```

## 3. Add it in Forge

1. Open Forge → new project or an existing chat.
2. Paste the snippet above into the prompt (keep the code fence or paste raw HTML).
3. Ask for a concrete placement, for example:

```text
Add this Snipcart embed in a Contact section on the landing page.
Use a responsive container and keep the design consistent with the rest of the site.
```

4. Review the live preview. Iterate in chat if spacing, height, or theme needs tweaks.

## 4. Caveats

Preview sandbox / CSP can block some third-party scripts. If the widget fails in preview, tell the agent.

Do not paste secret API keys (secret / private / webhook signing keys) into the frontend. Public keys and form IDs are OK.
