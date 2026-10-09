# Baserow

No-code database with public share views.

**Category:** data  
**Methods:** iframe  
**Access:** `yes`

## What you get

Baserow ships a browser embed you can drop into a Forge React site: typically an iframe, a script tag, or a small SDK snippet (iframe).

## Official docs

https://baserow.io/docs/

## 1. Create an account

1. Open the product and create a free (or trial) account.
2. Create the resource you want to embed (form, calendar, chat widget, payment button, map, …).
3. Open **Share**, **Embed**, or **Install** and copy the HTML/JS snippet.

## 2. Example embed

Replace `YOUR_*` placeholders with values from your dashboard.

```html
<!-- Paste the official embed snippet from Baserow here -->
<!-- Typical shapes: <iframe src="…"> or <script src="…"> -->
<iframe
  src="https://example.com/embed/YOUR_ID"
  style="width:100%;min-height:480px;border:0;"
  title="Baserow"
></iframe>
```

## 3. Add it in Forge

1. Open Forge → new project or an existing chat.
2. Paste the snippet above into the prompt (keep the code fence or paste raw HTML).
3. Ask for a concrete placement, for example:

```text
Add this Baserow embed in a Contact section on the landing page.
Use a responsive container and keep the design consistent with the rest of the site.
```

4. Review the live preview. Iterate in chat if spacing, height, or theme needs tweaks.

## 4. Caveats

Preview sandbox / CSP can block some third-party scripts. If the widget fails in preview, tell the agent.

Do not paste secret API keys (secret / private / webhook signing keys) into the frontend. Public keys and form IDs are OK.
