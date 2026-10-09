# Mailchimp

Embedded signup forms.

**Category:** email  
**Methods:** script, iframe  
**Access:** `yes`

## What you get

Mailchimp ships a browser embed you can drop into a Forge React site: typically an iframe, a script tag, or a small SDK snippet (script, iframe).

## Official docs

https://mailchimp.com/help/add-a-signup-form-to-your-website/

## 1. Create an account

1. Open the product and create a free (or trial) account.
2. Create the resource you want to embed (form, calendar, chat widget, payment button, map, …).
3. Open **Share**, **Embed**, or **Install** and copy the HTML/JS snippet.

## 2. Example embed

Replace `YOUR_*` placeholders with values from your dashboard.

```html
<!-- Paste the form HTML exported from Mailchimp Audience → Signup forms → Embedded forms -->
<div id="mc_embed_signup">
  <form action="https://YOUR_LIST.usX.list-manage.com/subscribe/post?u=...&id=..."
        method="post" id="mc-embedded-subscribe-form">
    <input type="email" name="EMAIL" required placeholder="Email" />
    <button type="submit">Subscribe</button>
  </form>
</div>
```

## 3. Add it in Forge

1. Open Forge → new project or an existing chat.
2. Paste the snippet above into the prompt (keep the code fence or paste raw HTML).
3. Ask for a concrete placement, for example:

```text
Add this Mailchimp embed in a Contact section on the landing page.
Use a responsive container and keep the design consistent with the rest of the site.
```

4. Review the live preview. Iterate in chat if spacing, height, or theme needs tweaks.

## 4. Caveats

Preview sandbox / CSP can block some third-party scripts. If the widget fails in preview, tell the agent.

Do not paste secret API keys (secret / private / webhook signing keys) into the frontend. Public keys and form IDs are OK.
