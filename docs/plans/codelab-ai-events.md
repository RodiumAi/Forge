# Codelab AI: request fields and SSE events

Contract delivered by wave 2 agent G (`apps/api/app/services/codelab/`). It mirrors the slides contract (`deck-ai-events.md`); the codelab editor (`apps/web/components/codelab-editor/`) builds on it.

## Request (backward compatible)

`POST /projects/{id}/chats/{chat_id}/messages` and `.../messages/branch`:

```json
{"content":"Ajoute une route POST","mode":"agent","model":null,
 "target":{"stepId":"routes"},
 "action":null,"action_input":null}
```

- `target.stepId`: the step the AI may change (same id pattern as slide ids). Other target keys are ignored.
- `action`:
  - `check_code`: review code consistency across steps, nothing written, no target needed;
  - `make_files`: write starter and/or solution files under `files/` (`action_input` or the message may say `starter` or `solution`; both by default);
  - `shorten`, `punchier`, `translate` (deck actions) also work on a step and need `target.stepId`; `action_input` is the language for `translate`.
- `content` is still required (send the action label for an action).

Routing: codelab projects go to `services/codelab` when `FORGE_KIND_CODELAB_ENABLED` is on; flag off: one frame `{"type":"error","code":"kind_not_available","kind":"codelab","message":"..."}`. The 402 wallet check runs first, as for every message.

Flow choice: `check_code`, then `make_files`, then a step target or step action (targeted edit), then a blank codelab (outline), otherwise a codelab-level edit. A codelab is blank when it only has the scaffold's intro step with no text.

Models: same routes as the slides AI (`deck_routes`): outline, writing, codelab-level edits, checks and files use the writing model (escalation when allowed); a step target uses the edit model.

## Events

Existing events keep their meaning (`user_message`, `route`, `step`, `plan`, `file_write`, `file_delete`, `warning`, `error`, `done`). `route.task_class` is one of `codelab.outline`, `codelab.edit.target`, `codelab.edit`, `codelab.check`, `codelab.files`.

Step ids of the `step` events: `codelab_outline`, `codelab_write`, `codelab_edit`, `codelab_restructure`, `codelab_check`, `codelab_files`, `done`, and `task:<stepId>` per step while writing.

### 1. Outline (first message on a blank codelab)

user_message, route, step codelab_outline, then

```json
{"type":"codelab.outline","run_id":"<uuid>","outline":{"title":"...","summary":"...","level":"beginner",
 "prerequisites":["..."],"learn":["..."],
 "steps":[{"id":"installer-fastapi","title":"Installer FastAPI","idea":"...","minutes":7}],
 "files":{"starter":false,"solution":false}}}
{"type":"plan","run_id":"<uuid>","tasks":[{"id":"installer-fastapi","title":"...","status":"pending","detail":"<idea>","minutes":7}],
 "meta":{"title":"...","summary":"..."},"needs_confirm":true}
```

Step ids are kebab-case slugs of the titles (unique). The run stays in `awaiting_plan_confirm`; the outline is stored in `plan_meta_json.codelab` and comes back from `runs/active` after a refresh. `files` is true when the user asked for starter or solution files.

### 2. Confirm

`POST .../runs/{id}/confirm-plan` with `{"plan":[tasks...]}`. Tasks may be reordered, deleted or retitled; `title`, `detail`, `minutes` are read; unknown ids become new steps. Writing runs in the background through the run queue (`/runs/{id}/events?after=N` replays, cancel works).

- `{"type":"file_write","path":"codelab.json"}` then `{"type":"codelab.codelab","run_id","codelab":{...}}`: every step listed, each file holding only its heading. Step files are `steps/NN-<stepId>.md`.
- Per step: step `task:<id>` running, then a stream of
  `{"type":"codelab.delta","run_id","step_id":"installer-fastapi","text":"<next chunk of Markdown>"}`
  (chunks of about 240 characters; append them to show the step while it is written; the server trims a wrapping fence and adds the heading when missing, so the final text can differ slightly), then `file_write` for the step file, then
  `{"type":"codelab.step","run_id","step_id","index":1,"total":5,"step":{"id","title","file","minutes"},"markdown":"<final Markdown>","fallback":false}`,
  step `task:<id>` done. Replace the streamed text with `markdown`.
- Empty answer: the step gets its heading and idea (`fallback:true`) plus `{"type":"warning","message":"STEP_FALLBACK: <id>","violation":{"code":"STEP_FALLBACK","path":"steps/..."}}`.
- When the outline asked for files: the files events of section 6.
- End: `{"type":"codelab.done","run_id","steps":["intro",...],"warnings":[...]}` then `done`.

### 3. Step target

step codelab_edit, `codelab.delta` chunks for that step, `file_write` (only that step's file), optional `file_write codelab.json` + `codelab.codelab` when the step's level-1 heading changed (only that step's title is updated), then `{"type":"codelab.step",...,"target":{"stepId":"routes"}}`, `codelab.done`, `done`.

Enforced server-side: the model receives the outline and the neighbouring steps read-only, and the only files a step target can write are that step's Markdown and its own title in codelab.json.

### 4. Codelab-level edit

`file_write codelab.json`, `codelab.codelab`, `{"type":"codelab.step_removed","run_id","step_id":"intro"}` plus `file_delete` per removed step, `codelab.step` per new or rewritten step (no deltas: the answer is one JSON object), `codelab.done`, `done`. Metadata (title, summary, level, prerequisites, learn) may change; `durationMinutes` is recomputed from the steps.

### 5. Code check (`action: "check_code"`)

step codelab_check, then

```json
{"type":"codelab.check","run_id","summary":"...","issues":[
  {"stepId":"routes","severity":"error|warning|info","message":"...","fix":"..."}]}
```

`stepId` is null when the model named no existing step. Nothing is written. `done.check` repeats the review; `done.summary` is the summary (or a count).

### 6. Files (`action: "make_files"`, or `files` in a confirmed outline)

step codelab_files, `file_write` per file (under `files/starter/` or `files/solution/` only, upload policy applied: size, count, no executables), `{"type":"warning","message":"FILE_SKIPPED: <path>"}` for a refused file, `codelab.codelab` when a `starter` / `solution` ZIP download entry was added, then `{"type":"codelab.files","run_id","files":["files/starter/main.py",...]}`, `codelab.done`, `done`.

### Error codes

`kind_not_available`, `target_required`, `target_not_found`, `invalid_model_output`, plus the usual gateway codes.

## Routes beside the chat

- `GET/PUT /projects/{id}/codelab`, `GET/PUT /projects/{id}/steps/{sid}` (wave 0, ETag + If-Match).
- `GET /projects/{id}/codelab/files`, `POST` (multipart `file`, optional `folder`), `DELETE ?path=files/...`, `GET /files/raw?path=` (always a download).
- `POST /projects/{id}/codelab/import/claat` `{"markdown": "..."}` replaces the steps (history checkpoint first).
- `GET /projects/{id}/codelab/export/markdown`, `/export/sources` (ZIP of `files/`), `/export/pdf`: Starter and up (PDF needs `export_pdf`), open source unrestricted.
- `GET/PUT /projects/{id}/codelab/settings` `{"feedbackUrl":"https://..."}`: link of the end page, kept in `.forge/codelab-settings.json` (not part of the contract).
