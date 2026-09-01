# AWS Amplify — Forge frontend (`apps/web`)

App ID : `d2062iyqczgv3z` · Branch : `main` · Domain : `forge.rodiumai.io`

## Monorepo (required)

Amplify must know the Next.js app lives under `apps/web`, not the repo root.

1. **Environment variable** (app + branch `main`) :
   ```
   AMPLIFY_MONOREPO_APP_ROOT=apps/web
   ```
2. **Build spec** : `amplify.yml` at **repo root** with `applications[].appRoot: apps/web`.

Without both, builds fail with:
`CustomerError: Cannot read 'next' version in package.json`

## Environment variables (branch `main`)

See [env.example](./env.example). Set in Amplify console or:

```bash
aws amplify update-app --app-id d2062iyqczgv3z --region eu-west-1 \
  --environment-variables "AMPLIFY_MONOREPO_APP_ROOT=apps/web,..."
```

## Notes

- Pin `next` to an exact semver in `apps/web/package.json` (no `^`) — Amplify's detector is strict.
- Do **not** set `DOCKER_BUILD=1` on Amplify (breaks WEB_COMPUTE SSR routing).
- `FORGE_FONT_MODE=fallback` recommended for CI/Amplify builds.
