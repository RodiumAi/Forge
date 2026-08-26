# Firestore + Auth emulators (Forge builder live mirror)

Forge uses Firestore as a **live UI mirror** (preview, publish, run, files). Postgres remains durable truth.

## Start emulators (repo root)

```sh
firebase emulators:start --only firestore,auth --project rodiumai-local
```

| Service   | Port | Note                                      |
|-----------|------|-------------------------------------------|
| Firestore | 8085 | Not 8080 — Caddy Forge uses 8080 locally  |
| Auth      | 9099 | Custom tokens for the Next.js builder     |
| Emulator UI | 4000 | http://localhost:4000                   |

Database id: `rodiumaidb` (see root `firebase.json`).

## Env — API on host

```env
FIRESTORE_ENABLED=true
FIREBASE_PROJECT_ID=rodiumai-local
FIRESTORE_DATABASE=rodiumaidb
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

## Env — API in Docker

Use `host.docker.internal` (already in Compose `extra_hosts`):

```env
FIRESTORE_EMULATOR_HOST=host.docker.internal:8085
FIREBASE_AUTH_EMULATOR_HOST=host.docker.internal:9099
```

## Env — Next.js web

```env
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1
NEXT_PUBLIC_FIREBASE_PROJECT_ID=rodiumai-local
NEXT_PUBLIC_FIRESTORE_DATABASE=rodiumaidb
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

The UI calls `POST /auth/firebase-custom-token` then `signInWithCustomToken` before `onSnapshot`.
