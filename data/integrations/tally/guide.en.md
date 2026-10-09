# Tally

Embed forms without a backend.

**Category:** forms  
**Methods:** iframe, script  
**Access:** `yes`

## What you get

Tally ships a browser embed you can drop into a Forge React site: typically an iframe, a script tag, or a small SDK snippet (iframe, script).

## Official docs

https://developers.tally.so/widgets/embeds

## 1. Create an account

1. Open the product and create a free (or trial) account.
2. Create the resource you want to embed (form, calendar, chat widget, payment button, map, …).
3. Open **Share**, **Embed**, or **Install** and copy the HTML/JS snippet.

## 2. Example embed

Replace `YOUR_*` placeholders with values from your dashboard.

```html
<!-- Tally embed (iframe) -->
<iframe
  data-tally-src="https://tally.so/embed/YOUR_FORM_ID?alignLeft=1&hideTitle=1&transparentBackground=1"
  width="100%"
  height="500"
  frameborder="0"
  marginheight="0"
  marginwidth="0"
  title="Contact form"
></iframe>
<script async src="https://tally.so/widgets/embed.js"></script>
```

## 3. Add it in Forge

1. Open Forge → new project or an existing chat.
2. Paste the snippet above into the prompt (keep the code fence or paste raw HTML).
3. Ask for a concrete placement, for example:

```text
Add this Tally embed in a Contact section on the landing page.
Use a responsive container and keep the design consistent with the rest of the site.
```

4. Review the live preview. Iterate in chat if spacing, height, or theme needs tweaks.

## 4. Caveats

Preview sandbox / CSP can block some third-party scripts. If the widget fails in preview, tell the agent.

Do not paste secret API keys (secret / private / webhook signing keys) into the frontend. Public keys and form IDs are OK.
