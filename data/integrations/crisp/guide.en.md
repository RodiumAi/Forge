# Crisp

Live chat widget with a paste-in snippet.

**Category:** chat  
**Methods:** script  
**Access:** `yes`

## What you get

Crisp ships a browser embed you can drop into a Forge React site: typically an iframe, a script tag, or a small SDK snippet (script).

## Official docs

https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/npm/

## 1. Create an account

1. Open the product and create a free (or trial) account.
2. Create the resource you want to embed (form, calendar, chat widget, payment button, map, …).
3. Open **Share**, **Embed**, or **Install** and copy the HTML/JS snippet.

## 2. Example embed

Replace `YOUR_*` placeholders with values from your dashboard.

```html
<script type="text/javascript">
  window.$crisp=[];window.CRISP_WEBSITE_ID="YOUR_WEBSITE_ID";
  (function(){d=document;s=d.createElement("script");
  s.src="https://client.crisp.chat/l.js";s.async=1;
  d.getElementsByTagName("head")[0].appendChild(s);})();
</script>
```

## 3. Add it in Forge

1. Open Forge → new project or an existing chat.
2. Paste the snippet above into the prompt (keep the code fence or paste raw HTML).
3. Ask for a concrete placement, for example:

```text
Add this Crisp embed in a Contact section on the landing page.
Use a responsive container and keep the design consistent with the rest of the site.
```

4. Review the live preview. Iterate in chat if spacing, height, or theme needs tweaks.

## 4. Caveats

Preview sandbox / CSP can block some third-party scripts. If the widget fails in preview, tell the agent.

Do not paste secret API keys (secret / private / webhook signing keys) into the frontend. Public keys and form IDs are OK.
