> 🇫🇷 [Version française](ARCHITECTURE.fr.md)

# Architecture

How Forge turns a chat message into a running React app, and where each piece
lives. Written for contributors — every claim below points at a file you can
open.

## The short version

```
apps/web      Next.js 15 App Router — builder UI, SSE consumer
apps/api      FastAPI — routing, agent orchestration, publishing
  runtime/    Node + browser Babel/ESM toolchain (shared by preview AND publish)
data/         templates/ (36 starter kits) · integrations/ · projects/ (generated workspaces)
infra/        local Docker stack · CI helpers · AWS sites gateway
```

Supporting services: **Postgres**, **MinIO** (S3), **Valkey** (Redis), **Caddy**
(serves published sites). LLM calls go out to the RodiumAI gateway.

Three ideas explain most of the design:

1. **No build step, ever.** Generated projects are never compiled server-side.
   The browser transforms them with Babel standalone and loads dependencies from
   a CDN import map. There is no `node_modules`, no Vite dev server.
2. **One manifest, two consumers.** `apps/api/runtime/packages.json` is the
   single source of truth for the import map, the import allowlist, and Monaco
   types. Preview and publish read the *same* file through the *same* resolver.
3. **Credentials stay out of the repo.** On Forge Cloud, generation uses the
   user's OAuth access token plus an API **key id** — the key secret never
   reaches this codebase. Self-host pastes a BYOK `rd_sk_…` key into settings
   (encrypted at rest); Cloud spends **FRODI** first, then **RODI**.

## A generation run, end to end

```mermaid
sequenceDiagram
  participant UI as apps/web
  participant API as routers/chats.py
  participant D as orchestration/dispatcher.py
  participant LLM as services/llm.py
  UI->>API: POST /projects/{p}/chats/{c}/messages
  API->>API: classify_and_route() → task_class, model, tier
  API->>API: persist Message + AgentRun(running)
  alt needs clarification
    API-->>UI: SSE clarify{questions}
  else plan mode
    API->>API: build_plan() → tasks
    API-->>UI: SSE plan{tasks, needs_confirm}
    UI->>API: POST .../confirm-plan
  end
  loop per task
    D->>LLM: stream_chat_completion()
    LLM-->>D: token / thinking deltas
    D->>D: parse <forge-write> → validate → apply
    D-->>UI: SSE token, file_write, step
  end
  D-->>UI: SSE preview_refresh, done
```

**Entry points.** The UI posts from `apps/web/app/projects/[id]/page.tsx` and
folds each event through `apps/web/lib/chat-stream.ts` (`reduceStreamEvent`
returns `{state, effects}`; the page performs the effects). The server side is
`apps/api/app/routers/chats.py` (`send_message`), which picks one of four
branches — image, clarify, single-pass, or plan.

**Streaming.** Everything is SSE, wrapped by `with_sse_heartbeats`
(`apps/api/app/services/sse.py`) which emits `: hb <ts>` comments so a quiet run
is not cut by a proxy. Raise `ALB_IDLE_TIMEOUT_SECONDS` (default 600) to match
your load balancer.

**Event contract** — every frame is `data: <json>`:

| `type` | Meaning |
|---|---|
| `user_message` | run id handshake |
| `route` | routing decision (task class, tier) |
| `step`, `plan`, `plan_task` | activity panel and plan checklist |
| `token`, `thinking` | assistant text / reasoning deltas |
| `clarify` | human-in-the-loop gate; releases the composer |
| `file_write`, `file_delete` | an op was applied |
| `preview_refresh` | emitted at task boundaries, not per write |
| `warning` | validator or verify finding |
| `error`, `done` | terminal |

**Reconnects are first class.** A run is produced by a background task, not by
the HTTP handler — closing the tab does not kill it. `GET .../runs/active`
restores HITL state and `GET .../runs/{id}/events?after=N` replays then tails.

**The LLM call** is plain `httpx` against an OpenAI-compatible
`/chat/completions` — there is no vendor SDK. See `apps/api/app/services/llm.py`.

## The agent loop

**Forge does not use function calling.** The model writes XML tags in its normal
output and the server parses them (`apps/api/app/prompts/system.py` defines the
contract, `apps/api/app/services/tags.py` parses it):

```
<forge-write path="src/App.tsx"> …file contents… </forge-write>
<forge-edit path="src/App.tsx">
<<<<<<< SEARCH
exact current lines
=======
replacement lines
>>>>>>> REPLACE
</forge-edit>
<forge-delete path="src/Old.tsx"></forge-delete>
```

`forge-edit` applies search/replace hunks to the current file
(`services/edit_apply.py`: exact match, then a whitespace-tolerant line match,
never an ambiguous one); an edit that does not apply gets one focused retry with
the file shown in full.

**Output limits.** Every code stream sends `max_tokens` (the gateway otherwise
caps Claude/Gemini at 4096 output tokens) and reads `finish_reason`. An answer
cut by the limit, or a tag left open, is continued (`stream_with_continuation`
in `services/llm.py`): the re-emitted file wins over the cut one, and a file still
cut after the last round is reported to the user instead of vanishing.

A consequence worth knowing: **the agent does not choose which files to read.**
Context assembly is heuristic: `apps/api/app/services/orchestration/context.py`
selects files by relevance, forced paths, and the plan's declared `files`
(directories expand to their files), then layers the system prompt,
`AI_RULES.md`, a locked `DESIGN.md`, the project images with their real sizes, a
starter-kit excerpt as quality reference on young builds, file skeletons (CSS
files list their classes) and the selected bodies (160k characters, index.css
first). Older history is compacted by an LLM pass.

Phases: classify → optional clarify → plan → brand bootstrap (first build of a
blank project: `services/brand_charter.py` writes a DESIGN.md with a palette, a
validated Google Fonts pair and an imagery direction, then the first WebP images)
→ execute → verify/repair (on the model that wrote the code). Plans of four or
more tasks, and any scaffold, pause for user confirmation.
`apps/api/app/services/orchestration/dispatcher.py` runs tasks sequentially.

**CSS ownership is one rule everywhere**: `src/index.css` is the foundation,
written once by the styles_foundation task; each page owns
`src/styles/<page>.css`, scoped under its root class. Orphan classes are reported
against the component and its stylesheet.

**Writes are validated before anything touches disk**
(`apps/api/app/services/apply_writes.py`):

- A **git snapshot** is taken first: each project is its own private repo under
  `data/projects/{id}`, which is what powers history and rollback.
- Imports are checked against the manifest allowlist using **tree-sitter**
  (`services/import_validator.py`), falling back to regex when unavailable.
  Violations: `BUILD_FORBIDDEN_IMPORT`, `BUILD_INVALID_NAMED_EXPORT`.
- `DESIGN.md` and `public/logo.*` are brand-locked unless the request explicitly
  asks to change the brand; the placeholder charter of a blank scaffold is not a
  brand and is never locked.
- A full rewrite of `src/index.css` that drops rules keeps them (merge);
  deliberate removals go through `forge-edit`. Page stylesheets are owned by
  their task and rewritten freely.

## Preview

No dev server is ever started. `GET /runner/` renders a shell
(`apps/api/app/services/preview_babel.py`) that injects the import map, the
allowed parent origins, and Babel standalone. The UI then fetches the project's
source bundle and posts `{type:"forge:render", files, entry}` into the iframe.

Inside the iframe (`apps/api/runtime/`):

1. `transform.mjs` — Babel with the React automatic runtime + TypeScript presets.
2. Bare specifiers are checked against the document's own import map → `IMPORT_NOT_IN_MANIFEST`.
   Specifiers are collected with tight regexes (no quotes between `import`/`export`
   and `from`) plus a plausibility filter so Babel output fragments such as
   `/*#__PURE__*/_jsxs` or the word `from` inside a string like `"or start from"`
   are never treated as packages.
3. `topo.mjs` — topological sort, raising `CIRCULAR_DEPENDENCY` with the cycle.
4. `rewrite.mjs` + `resolve.mjs` — each specifier is rewritten to the dependency's already-created `blob:` URL. Resolution is **case-sensitive** and understands `@/` → `src/`.
5. `await import(entryBlobUrl)`. Old blobs are revoked on success, kept on failure so the error stays inspectable.

The import map is not mutable after load, which is why the project's own extra
dependencies must be injected at shell-render time (`?p=<uuid>`). Bump the
`?v=` query on `runner.js` / `bridge.js` in `preview_babel.py` whenever the
runner contract changes, or browsers keep a stale transform.

**During generation the builder hides the blocking Babel overlay**
(`PreviewPane` `suppressErrorOverlay` while `busy || streamActive`). Mid-plan
files are often briefly inconsistent; the overlay returns once the run settles
if the preview is still broken.

**Origin pinning is strict in both directions.** `RUNNER_PARENT_ORIGINS` builds
an allowlist; the runner refuses to send to anything else. The code notes this
was tightened after accepting any localhost port let a rogue local page read app
content.

## Attachments, logos, and URL cloning

Prompt images carry an **intent** (`apps/web/lib/prompt-attachments.ts` +
`apps/api/app/services/attachments.py`):

| Intent | UI label (FR) | Effect |
|---|---|---|
| `reference` | Capture de référence | Vision-only; multi-page plans when ≥2 references |
| `asset` | Asset joint | Materialized under `public/` (logo → `public/logo.*`); the agent must use those paths and must not redraw the logo |

`reference` and `asset` **coexist** on the same message — a screenshot no longer
overwrites a logo.

If the user pastes a public site URL without enough reference shots, the API
captures desktop + mobile screenshots with Playwright
(`apps/api/app/services/url_capture.py`, wired in `routers/chats.py`) and appends
them as `intent:reference` markers before routing. Chromium is installed in the
API image (`playwright install --with-deps chromium`).

## Publishing

`POST /projects/{id}/publish` → `apps/api/app/services/publish_esm.py`:

1. **Production build.** `node apps/api/runtime/cli.mjs` (project on stdin)
   runs the *same* Babel transform as the preview, then esbuild
   (`runtime/build.mjs`) bundles the app and its dependencies (fetched once
   from esm.sh, cached on disk), tree-shakes (lucide-react comes from the npm
   package), minifies and content-hashes `assets/*.js`, with `modulepreload`
   links and no source maps. If the CDN is unreachable, dependencies stay
   external behind an import map limited to what the app imports. All CSS is
   minified into one `<style>` (`src/index.css` first); web-font `@import`s
   become `<link>` + preconnect. Assets imported from code are copied;
   oversized images are resized and recompressed in place.
2. **Pre-render** (`services/prerender.py`): headless Chromium loads the build
   from disk (no other network), follows the site's own links, and saves each
   route as `<route>/index.html` with its markup, title and the tags pages set
   through react-helmet-async; `404.html` is rendered from an unknown path.
3. **SEO** (`services/site_seo.py`): `<html lang>` detected from the text,
   per-page canonical and og:url, absolute og/twitter images, og:site_name,
   og:locale, schema.org WebSite on the home page, `sitemap.xml` and
   `robots.txt` (unless the project ships its own).
4. **Upload** under `{slug}/` with `Cache-Control` (hashed assets immutable,
   pages revalidated), pages last, then stale keys are removed.

Caddy is a **pure reverse proxy to the bucket** (`infra/local/Caddyfile`,
`infra/aws/sites-gateway/Caddyfile`, one shared snippet): `/` serves
`index.html`; a file path serves the file or a plain 404; a page path serves
`<page>/index.html`, else `404.html` **with status 404**, else `index.html`
(sites published before pre-rendering). 403 counts as missing. Responses are
compressed (zstd/gzip); SVGs render as images but are sandboxed when opened.

A published site is static: the gateway never forwards anything from it to the
API. Forms and analytics are integration-catalog embeds. Pre-rendering runs in a child process with a scrubbed environment and a hard deadline (`services/prerender.py`).

`/v1/authorize-host` exists **only for custom domains**: Caddy's `forward_auth`
asks the API whether a hostname maps to a validated `ProjectDomain`, and gets
back the slug to rewrite to. The slug always stays the S3 key; a custom domain
changes routing, never storage.

## Data model

`apps/api/app/models.py`, SQLAlchemy 2.0 on Postgres. The core chain is
`User → Project → Chat → Message`, with `AgentRun` recording each generation
(status, plan, clarify answers, and `cursor_task_index` so a run can resume).
`UserSettings` holds encrypted RodiumAI tokens. `ProjectDomain`, `StoredObject`,
`SiteUsageDay`, `PreviewComment` and `ModelCatalog` round it out.

**There is no Alembic.** `apps/api/app/db.py` runs `create_all()` followed by a
hand-written list of idempotent statements (`ADD COLUMN IF NOT EXISTS`, …), run
from the FastAPI lifespan and from `make migrate`. There is **no rollback path
and no version table** — add schema changes as new idempotent statements, and
expect to handle backfills yourself.

## Authentication

Two independent layers (plus optional Cloud entitlements):

- **Local Forge accounts** — `POST /auth/register` creates an email/password
  user (HTTP 201). The session JWT is HS256 over `SECRET_KEY` (7 days).
  `get_current_user` accepts Bearer *or* `?access_token=` so `<img src>` loads
  work. Optional Google uses Firebase ID tokens.
- **RodiumAI OIDC** — authorization-code + PKCE (`services/rodium_oidc.py`).
  Appears only when `RODIUM_OIDC_CLIENT_ID` is set; otherwise
  `/auth/rodium/start` returns 503 and the UI hides the button. Access/refresh
  tokens are Fernet-encrypted in `user_settings`.
- **Forge Cloud entitlements** — when `forge_cloud_enabled` is true (OIDC +
  Forge scopes), the API pulls plan/FRODI from Nest
  (`GET …/internal/forge/balance`), caches them, and exposes
  `GET /auth/forge/status`. **FRODI** is the primary reservoir; **RODI** is the
  wallet fallback. Plan grants and Free+500 live in Nest, not in this repo.

`resolve_generation_auth` (`services/rodium_generation.py`) runs at the top of
every generation endpoint. On the Cloud path it sends the user's access token
plus an API **key id** — **the key secret never reaches Forge.** Self-host /
legacy can decrypt a pasted key instead.

> Self-host does **not** require OIDC. Local `/register` works with an empty
> `RODIUM_OIDC_CLIENT_ID`. Forge Cloud (`forge.rodiumai.io`) uses OIDC SSO and
> Nest-backed FRODI plans.
## Background work

**Everything runs in the API process.** `spawn_plan_job` creates an
`asyncio.Task`; the HTTP handler only relays from a buffer. There is no worker
container, and `docker-compose.yml` defines none.

Valkey/Redis is used for the run event log (24h TTL, the durable replay buffer),
a run claim key, and a cancellation flag. **It is optional**: every helper
degrades to an in-process mirror when Redis is unreachable, because a down
Valkey used to produce a silent infinite spinner.

## Rough edges worth knowing

Honest notes for anyone reading the code and wondering:

- `forge:plan:queue` is pushed to but **never popped** — a placeholder for a
  future worker that does not exist yet.
- `providers/keys.py` and `providers/secrets.py` are complete but appear to have
  **no importers**; the encryption actually in use is Fernet in `app/crypto.py`.
  Production config still asserts KMS/Secrets Manager.
- `providers/queue.py` defines a full Redis Streams usage queue that nothing
  publishes to or consumes; `SiteUsageDay` is written synchronously instead.
- `Project.preview_port` / `preview_running` are vestigial from a Vite-dev-server
  era.
- `apps/web/lib/preview-host.ts` rewrites to `/preview-by-slug/{slug}`, for which
  **no FastAPI route exists** — locally Caddy serves those hosts from MinIO. It
  looks like a leftover from the pre-Caddy architecture.

## Where to go next

- [CONTRIBUTING.md](../CONTRIBUTING.md) — setup, checks, PR process
- [TEMPLATES.md](TEMPLATES.md) — the template-kit authoring contract
- [DOCKER.md](../DOCKER.md) — local stack, ports, preview notes
