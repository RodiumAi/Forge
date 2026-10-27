# Slides AI: request fields and SSE events

Contract delivered by wave 1 agent C (`apps/api/app/services/deck_ai/`). The deck editor (agent B) builds on it.

## Request (backward compatible)

`POST /projects/{id}/chats/{chat_id}/messages` and `.../messages/branch` accept three optional fields:

```json
{"content":"Raccourcir","mode":"agent","model":null,
 "target":{"slideId":"s2","elementId":"body"},
 "action":"shorten","action_input":null}
```

- `action`: `shorten | punchier | change_layout | add_visual | translate`. `action_input`: a layout name for `change_layout`, a language for `translate` (default English when the locale is fr, otherwise French).
- `content` is still required (min 1 character): send the action label.
- `target` ignores unknown keys (room for `route`, `forgeId`, `filePath` later).

Routing: web and mobile unchanged. Slides go to `deck_ai` when `FORGE_KIND_SLIDES_ENABLED` is on. Codelab, design system, or slides with the flag off: one frame `{"type":"error","code":"kind_not_available","kind":"codelab","message":"..."}`. The 402 wallet check runs first.

Flow choice: target or action gives a targeted edit; a blank deck gives the outline; otherwise a deck-level edit.

## Events

Existing events are unchanged (user_message, route, step, plan, file_write, file_delete, warning, error, done). Per-slide progress uses `step` with `id:"task:<slideId>"`; other step ids: `deck_outline`, `deck_write`, `deck_edit`, `deck_restyle`, `deck_visual`, `done`.

### 1. Outline (first message on a blank deck)

user_message, route (`task_class:"deck.outline"`), step deck_outline, then

```json
{"type":"deck.outline","run_id":"<uuid>","outline":{"title":"...","summary":"...","format":"16:9",
 "slides":[{"id":"s1","title":"...","idea":"...","layout":"title","visual":false}]}}
{"type":"plan","run_id":"<uuid>","tasks":[{"id":"s1","title":"...","status":"pending","detail":"<idea>","layout":"title","visual":false}],
 "meta":{"title":"...","summary":"..."},"needs_confirm":true}
```

The run stays in `awaiting_plan_confirm`; the outline is stored in `plan_meta_json.deck` and restored by `runs/active` after a refresh. Layouts: title, section, text, two-columns, image-text, quote, key-numbers, chart, table, team, timeline, thanks.

### 2. Confirm

`POST .../runs/{id}/confirm-plan` with `{"plan":[tasks...]}`. Tasks may be reordered, deleted or retitled; `title`, `detail`, `layout`, `visual` are read; unknown ids become new slides. Writing runs in the background through the run queue (`/runs/{id}/events?after=N` replays, cancel works).

- `{"type":"file_write","path":"deck.json"}` then `{"type":"deck.deck","run_id","deck":{...}}` (all slides first written empty).
- Per slide: step `task:sN` running, optional step `deck_visual`, file_write for `slides/sN.json`, `notes/sN.md` and the image, then
  `{"type":"deck.slide","run_id","slide_id":"s2","index":1,"total":8,"slide":{...},"notes":"...","repaired":true,"fallback":false}`, step `task:sN` done.
- Unrepairable slide: plain layout slide (`fallback:true`) plus `{"type":"warning","message":"SLIDE_FALLBACK: s3","violation":{"code":"SLIDE_FALLBACK","path":"slides/s3.json"}}`.
- End: `{"type":"deck.done","run_id","slides":["s1",...],"warnings":[...]}` then `done`.

### 3. Targeted edit

step deck_edit, optional `TARGET_SCOPE` warning, file_write, optional `deck.deck` (change_layout), then `{"type":"deck.slide",...,"target":{"slideId":"s2","elementId":"body"}}`, `deck.done`, `done`.

### 4. Deck-level edit

`deck.deck`, `{"type":"deck.slide_removed","run_id","slide_id":"s1"}` plus file_delete, `deck.slide` per new or changed slide, `deck.done`, `done`.

### Error codes

`kind_not_available`, `target_required`, `target_not_found`, `invalid_model_output`.

## Notes routes

`GET /projects/{id}/notes/{sid}` returns `{"id":"s1","file":"notes/s1.md","markdown":""}` with an ETag; `PUT {"markdown":"..."}` (max 20,000 chars), If-Match, 409 on conflict, 404 for a slide not in the deck.

## Server behaviour worth knowing in the editor

- The server writes to disk before emitting `deck.slide` / `deck.deck`: the editor should replace its copy of that slide (and keep local unsaved edits of other slides), then fetch the ETag before its next PUT.
- Visuals: placeholder `public/images/__visual__.webp` replaced by an imported Pixabay WebP `public/images/pixabay-<id>.webp` with credit; removed if no key or no hit.
