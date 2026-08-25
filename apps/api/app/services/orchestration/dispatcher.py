"""Sequential multi-task execution for Forge agent plans."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.i18n import Locale, t
from app.services.filesystem import delete_file, write_file
from app.services.llm import RodiumError, stream_chat_completion
from app.services.orchestration.context import build_llm_messages
from app.services.rodium_generation import RodiumGenerationAuth
from app.services.tags import parse_forge_tags
from app.services.text_plain import build_run_summary, to_plain_text


def _sse(payload: dict) -> str:
    import json

    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def run_plan_tasks(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    answers_block: str,
    tasks: list[dict[str, Any]],
    model: str,
    auth: RodiumGenerationAuth,
    locale: Locale,
    run_id: str | None = None,
) -> AsyncIterator[str]:
    """Yield SSE chunks while executing each plan task sequentially."""
    from app.services.orchestration.cancel import is_cancelled

    thinking_parts: list[str] = []
    full: list[str] = []
    applied: list[dict] = []
    steps: list[dict] = []

    def push_step(step_id: str, label: str, status: str) -> str:
        existing = next((s for s in steps if s["id"] == step_id), None)
        if existing:
            existing["status"] = status
            existing["label"] = label
        else:
            steps.append({"id": step_id, "label": label, "status": status})
        return _sse({"type": "step", "id": step_id, "label": label, "status": status})

    for idx, task in enumerate(tasks):
        if run_id and is_cancelled(run_id):
            task["status"] = "error"
            yield _sse({"type": "error", "message": "cancelled"})
            return

        tid = str(task.get("id") or f"task_{idx+1}")
        title = str(task.get("title") or tid)
        task["status"] = "running"
        yield _sse({"type": "plan_task", "id": tid, "status": "running", "label": title})
        yield push_step(f"task:{tid}", title, "running")

        task_prompt = (
            f"User request:\n{user_prompt}\n\n"
            f"{answers_block}\n\n"
            f"Current plan task ({idx + 1}/{len(tasks)}): {title}\n"
            "Implement ONLY this task using forge-write / forge-delete tags. "
            "Keep changes focused. Write complete file contents when editing. "
            "Do not write markdown feature lists or emoji outside the tags."
        ).strip()

        yield push_step("select_files", t("step_select_files", locale), "running")
        llm_messages = build_llm_messages(
            project_id=project_id,
            history=history + [("user", task_prompt)],
            user_query=task_prompt,
        )
        yield push_step("select_files", t("step_select_files", locale), "done")
        yield push_step("generate", t("step_generate", locale), "running")

        task_buf: list[str] = []
        try:
            async for chunk in stream_chat_completion(
                auth=auth,
                model=model,
                messages=llm_messages,
                locale=locale,
            ):
                if run_id and is_cancelled(run_id):
                    task["status"] = "error"
                    yield push_step("generate", t("step_generate", locale), "error")
                    yield _sse({"type": "error", "message": "cancelled"})
                    return
                if chunk.kind == "thinking":
                    thinking_parts.append(chunk.content)
                    yield _sse({"type": "thinking", "delta": chunk.content})
                else:
                    task_buf.append(chunk.content)
                    full.append(chunk.content)
                    yield _sse({"type": "token", "content": chunk.content})
        except RodiumError as exc:
            task["status"] = "error"
            yield push_step("generate", t("step_generate", locale), "error")
            yield push_step(f"task:{tid}", title, "error")
            yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
            yield _sse({"type": "error", "message": str(exc)})
            return
        except Exception as exc:
            task["status"] = "error"
            yield push_step("generate", t("step_generate", locale), "error")
            yield push_step(f"task:{tid}", title, "error")
            yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
            yield _sse({"type": "error", "message": str(exc)[:400] or t("step_generate", locale)})
            return

        yield push_step("generate", t("step_generate", locale), "done")
        yield push_step("apply_writes", t("step_apply_writes", locale), "running")
        assistant_text = "".join(task_buf)
        writes, deletes = parse_forge_tags(assistant_text)
        for op in writes:
            write_file(project_id, op.path, op.content)
            applied.append({"op": "write", "path": op.path})
            yield _sse({"type": "file_write", "path": op.path})
        for op in deletes:
            delete_file(project_id, op.path)
            applied.append({"op": "delete", "path": op.path})
            yield _sse({"type": "file_delete", "path": op.path})
        yield push_step("apply_writes", t("step_apply_writes", locale), "done")

        task["status"] = "done"
        yield push_step(f"task:{tid}", title, "done")
        yield _sse({"type": "plan_task", "id": tid, "status": "done", "label": title})

    if applied:
        yield push_step("sync_deps", t("step_sync_deps", locale), "running")
        try:
            from app.services.preview import refresh_preview_after_deps

            await refresh_preview_after_deps(project_id)
            yield push_step("sync_deps", t("step_sync_deps", locale), "done")
        except Exception as exc:
            yield push_step("sync_deps", t("step_sync_deps", locale), "error")
            yield _sse({"type": "warning", "message": f"deps sync: {str(exc)[:240]}"})

    summary = to_plain_text(
        build_run_summary(tasks=tasks, applied=applied, locale=locale)
    )

    yield push_step("done", t("step_done", locale), "done")
    yield _sse(
        {
            "type": "done",
            "applied": applied,
            "summary": summary,
            "assistant_content": "".join(full),
            "thinking_text": "".join(thinking_parts) or None,
            "steps": steps,
            "plan": tasks,
        }
    )
