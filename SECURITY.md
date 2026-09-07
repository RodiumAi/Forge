> 🇫🇷 [Version française](SECURITY.fr.md)

# Security Policy

## Supported versions

Only the main branch is supported. Security fixes land there first.

## Reporting a vulnerability

Report vulnerabilities **privately**. Pick whichever channel you can use:

1. **GitHub Security Advisory (preferred)** — [**Report a vulnerability**](https://github.com/RodiumAi/Forge/security/advisories/new) on the repository's *Security* tab.
2. **Email** — **forge@rodiumai.io**, if you cannot use GitHub.

Machine-readable contacts are also published at
[`/.well-known/security.txt`](https://forge.rodiumai.io/.well-known/security.txt) (RFC 9116).

Please:

- Do **not** open a public issue for security problems.
- Do not disclose the vulnerability publicly before a fix is released.
- Include enough detail to reproduce (affected version/commit, steps, impact, and a proof-of-concept where possible).

### Scope & good faith

Test against **your own local stack** (`docker compose up`) or a site you published
yourself — **never** against `rodiumai.io` or its subdomains without prior written
authorisation (request it at forge@rodiumai.io). No bug bounty is offered. Intrusive
testing (DoS, brute force, social engineering) and accessing data that is not yours are
never in scope. See [CONTRIBUTING.md → Cybersecurity](CONTRIBUTING.md#cybersecurity).

### What to expect

- **Acknowledgement:** within 5 business days.
- We investigate, work on a fix, and coordinate disclosure timing with you.
- We credit reporters who wish to be named once a fix ships (research done in good
  faith within the scope above will not lead to legal action).
