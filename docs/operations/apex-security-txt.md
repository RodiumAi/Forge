# Serve `security.txt` on the RodiumAi apex

`https://rodiumai.io/.well-known/security.txt` is currently caught by the
apex-to-`www` redirect on the LiteSpeed host (`185.22.110.178`). It therefore
redirects to the homepage instead of the security contact document.

This host is not managed by the Forge repository. Apply the following change
in the LiteSpeed virtual host that serves `rodiumai.io`.

## File

Create `<document-root>/.well-known/security.txt`:

```text
Contact: mailto:security@rodiumai.io
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en, fr
Canonical: https://rodiumai.io/.well-known/security.txt
Policy: https://www.rodiumai.io/docs/trust-and-security
```

Keep the file synchronized with the `www` copy and renew `Expires` before it
passes.

## Rewrite order

Exclude the well-known path before the catch-all redirect:

```apache
RewriteEngine On

RewriteRule ^\.well-known/security\.txt$ - [L]
RewriteRule ^ https://www.rodiumai.io%{REQUEST_URI} [R=301,L]
```

If the redirect is configured at virtual-host level, add a higher-priority
static context for `/.well-known/security.txt`; an `.htaccess` exclusion cannot
override a redirect that already ran at the virtual-host level.

Serve the file as `text/plain; charset=utf-8` over HTTPS. Do not redirect its
canonical apex URL to the homepage.

## Verification

```bash
curl -fsS -D - https://rodiumai.io/.well-known/security.txt
```

The expected result is `200 OK`, `Content-Type: text/plain`, and a body whose
`Canonical` value is the apex URL. Recheck with an RFC 9116 validator after
deployment.
