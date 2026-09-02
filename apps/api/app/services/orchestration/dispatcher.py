"""Sequential multi-task execution for Forge agent plans."""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from app.i18n import Locale, t
from app.services.apply_writes import apply_validated_writes_async
from app.services.filesystem import delete_file
from app.services.llm import RodiumError, is_transient_network_error, stream_chat_completion
from app.services.orchestration.context import build_llm_messages
from app.services.rodium_generation import RodiumGenerationAuth
from app.services.tags import parse_forge_tags
from app.services.text_plain import build_run_summary, to_plain_text


def _sse(payload: dict) -> str:
    import json

    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _resume_context_block(tasks: list[dict[str, Any]], applied: list[dict], idx: int) -> str:
    done = [str(t.get("title") or t.get("id") or "") for t in tasks if str(t.get("status") or "") == "done"]
    paths = sorted({str(a.get("path") or "") for a in applied if a.get("path")})
    lines = [
        "Resume context:",
        f"- Retrying task index {idx + 1}/{len(tasks)} after a previous interruption or failure.",
        "- Do not redo completed work. Preserve existing files unless this task requires edits.",
    ]
    if done:
        lines.append("- Completed tasks: " + "; ".join(done[:12]))
    if paths:
        lines.append("- Files already touched: " + ", ".join(paths[:40]))
    return "\n".join(lines)


def _coherence_task(locale: Locale) -> dict[str, Any]:
    files = [
        "src/context",
        "src/App.tsx",
        "src/main.tsx",
        "src/index.css",
        "DESIGN.md",
    ]
    if locale == "fr":
        return {
            "id": "coherence",
            "title": "Passe cohérence finale App + CSS + DESIGN + Context API",
            "acceptance": (
                "Provider keys = useX() consumers; classes TSX↔index.css; "
                "createRoot nommé; pas de crash mount"
            ),
            "files": files,
            "status": "pending",
        }
    return {
        "id": "coherence",
        "title": "Final coherence pass App + CSS + DESIGN + Context API",
        "acceptance": (
            "Provider keys match useX() consumers; TSX↔index.css classes; "
            "named createRoot; app mounts without throw"
        ),
        "files": files,
        "status": "pending",
    }


def ensure_coherence_task(tasks: list[dict[str, Any]], locale: Locale) -> list[dict[str, Any]]:
    """After multi-task plans, ensure a final coherence pass exists."""
    if len(tasks) < 2:
        return tasks
    if any(str(t.get("id") or "") == "coherence" for t in tasks):
        return tasks
    return [*list(tasks), _coherence_task(locale)]


def _task_prompt_block(task: dict[str, Any], *, idx: int, total: int) -> str:
    title = str(task.get("title") or task.get("id") or f"task_{idx + 1}")
    acceptance = str(task.get("acceptance") or "").strip()
    files = task.get("files") or []
    tid = str(task.get("id") or "").lower()
    lines = [
        f"Current plan task ({idx + 1}/{total}): {title}",
    ]
    if acceptance:
        lines.append(f"Acceptance: {acceptance}")
    if isinstance(files, list) and files:
        lines.append("Suggested files: " + ", ".join(str(p) for p in files[:12]))
    lines.append(
        "Implement ONLY this task using forge-write / forge-delete tags. "
        "Touch only the files required for it. Do not restyle unrelated sections. "
        "When rewriting a file, preserve unchanged sections verbatim. "
        "Do not write markdown feature lists or emoji outside the tags."
    )
    if tid == "styles_foundation":
        lines.append(
            "STYLES FOUNDATION: Write a complete src/index.css with design tokens, "
            "typography, layout shell, navbar and hero BASE styles, and utilities. "
            "Do not invent parallel naming schemes later tasks cannot reuse."
        )
    elif (
        tid != "styles_foundation"
        and tid != "architecture"
        and (
            tid in ("home", "primary_sections", "flows", "sections")
            or "section" in tid
            or "home" in tid
            or "flow" in tid
            or (total >= 2 and idx > 0)
        )
    ):
        lines.append(
            "CSS APPEND RULE (critical): When writing src/index.css you MUST preserve "
            "ALL existing selectors verbatim (especially navbar/hero/layout). "
            "Only APPEND new rules for this task's classes. Never replace the whole "
            "stylesheet with a shorter subset. Prefer reusing foundation classes."
        )
    if tid == "coherence":
        lines.append(
            "COHERENCE PASS (black-preview prevention):\n"
            "1) Align Context Provider value keys with every useX() destructuring "
            "(add aliases; do NOT rename half the consumers).\n"
            "2) Align TSX classNames with src/index.css (same naming scheme).\n"
            "3) Ensure src/main.tsx uses: import { createRoot } from 'react-dom/client'.\n"
            "4) Ensure arrays from context default to [] so .filter/.map never throw.\n"
            "5) Do not add new product features — only fix coherence."
        )
    return "\n".join(lines)


def _is_surgical_task(task: dict[str, Any], *, total_tasks: int) -> bool:
    tid = str(task.get("id") or "").lower()
    title = str(task.get("title") or "").lower()
    if tid in (
        "coherence",
        "edit",
        "styles",
        "polish",
        "home",
        "primary_sections",
        "flows",
        "sections",
    ):
        return True
    if total_tasks >= 2 and tid not in ("architecture", "structure"):
        # Multi-task plans after architecture: prefer minimal CSS/TSX diffs.
        return True
    return bool(total_tasks == 1 and ("edit" in tid or "modif" in title or "change" in title))


async def _stream_verify_repair(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    findings: list[Any],
    db,
    user_id,
    locale: Locale,
    auth: RodiumGenerationAuth,
    resolve_auth: Callable[[], Awaitable[RodiumGenerationAuth]] | None,
    run_id: str | None,
    tasks: list[dict[str, Any]],
    applied: list[dict],
    full: list[str],
    thinking_parts: list[str],
    step_id: str,
    step_label: str,
    snapshot_label: str,
    format_findings_for_prompt,
    push_step: Callable[[str, str, str], str],
    focus_paths: list[str] | None = None,
    extra_prompt: str = "",
    surgical_edit: bool = True,
) -> AsyncIterator[str]:
    """One LLM verify-repair pass."""
    from app.services.orchestration.cancel import is_cancelled
    from app.services.orchestration.router import route_task

    repair_route = route_task("verify.repair")
    repair_prompt = (
        f"User request (context):\n{user_prompt}\n\n"
        f"{format_findings_for_prompt(findings)}\n\n"
        f"{extra_prompt}\n\n"
        "Fix ONLY these issues with forge-write tags. Prefer extending the Context "
        "Provider with aliases over rewriting all consumers. Sync orphan CSS class "
        "names. Fix scroll (no overflow:hidden on html/body). "
        "Do not add new features."
    ).strip()
    repair_messages = await build_llm_messages(
        project_id=project_id,
        history=[*history, ("user", repair_prompt)],
        user_query=repair_prompt,
        db=db,
        user_id=user_id,
        locale=locale,
        auth=auth,
        model=repair_route.model,
        surgical_edit=surgical_edit,
        focus_paths=focus_paths,
    )
    current_auth = await resolve_auth() if resolve_auth else auth
    repair_buf: list[str] = []
    try:
        async for chunk in stream_chat_completion(
            auth=current_auth,
            model=repair_route.model,
            messages=repair_messages,
            locale=locale,
        ):
            if run_id and is_cancelled(run_id):
                yield push_step(step_id, step_label, "error")
                yield _sse({"type": "error", "message": "cancelled", "plan": tasks})
                return
            if chunk.kind == "thinking":
                thinking_parts.append(chunk.content)
                yield _sse({"type": "thinking", "delta": chunk.content})
            else:
                repair_buf.append(chunk.content)
                full.append(chunk.content)
                yield _sse({"type": "token", "content": chunk.content})
        writes, deletes = parse_forge_tags("".join(repair_buf))
        written, violations = await apply_validated_writes_async(
            project_id, writes, snapshot_label=snapshot_label
        )
        applied.extend(written)
        for item in written:
            yield _sse({"type": "file_write", "path": item["path"]})
        for v in violations:
            yield _sse(
                {
                    "type": "warning",
                    "message": f"{v.get('code')}: {v.get('message')}",
                    "violation": v,
                }
            )
        for op in deletes:
            delete_file(project_id, op.path)
            applied.append({"op": "delete", "path": op.path})
            yield _sse({"type": "file_delete", "path": op.path})
        yield push_step(step_id, step_label, "done")
    except Exception as exc:
        yield push_step(step_id, step_label, "error")
        yield _sse({"type": "warning", "message": f"verify repair failed: {str(exc)[:240]}"})


async def run_plan_tasks(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    answers_block: str,
    tasks: list[dict[str, Any]],
    model: str,
    auth: RodiumGenerationAuth,
    resolve_auth: Callable[[], Awaitable[RodiumGenerationAuth]] | None = None,
    on_progress: Callable[[list[dict[str, Any]], int], Awaitable[None] | None] | None = None,
    locale: Locale,
    run_id: str | None = None,
    user_id=None,
    db=None,
    step_mode: bool = False,
) -> AsyncIterator[str]:
    """Yield SSE chunks while executing each plan task sequentially."""
    from app.services.orchestration.cancel import is_cancelled

    tasks = ensure_coherence_task(tasks, locale)
    thinking_parts: list[str] = []
    full: list[str] = []
    applied: list[dict] = []
    steps: list[dict] = []

    async def emit_progress(cursor: int) -> None:
        if not on_progress:
            return
        result = on_progress(tasks, cursor)
        if result is not None:
            await result

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
            await emit_progress(idx)
            yield _sse({"type": "error", "message": "cancelled", "plan": tasks})
            return

        if str(task.get("status") or "") == "done":
            continue

        tid = str(task.get("id") or f"task_{idx + 1}")
        title = str(task.get("title") or tid)
        task["status"] = "running"
        await emit_progress(idx)
        yield _sse({"type": "plan_task", "id": tid, "status": "running", "label": title})
        yield push_step(f"task:{tid}", title, "running")

        is_resume = any(str(t.get("status") or "") == "done" for t in tasks) or bool(applied)
        resume_block = _resume_context_block(tasks, applied, idx) if is_resume else ""

        task_prompt = (
            f"User request:\n{user_prompt}\n\n"
            f"{answers_block}\n\n"
            f"{resume_block}\n\n"
            f"{_task_prompt_block(task, idx=idx, total=len(tasks))}"
        ).strip()

        surgical = _is_surgical_task(task, total_tasks=len(tasks))
        if surgical:
            task_prompt += (
                "\n\nSURGICAL EDIT: Prefer minimal diffs. Change only the lines needed "
                "for this task. Do not rewrite entire files unless the acceptance criteria "
                "require a full rewrite. Keep imports and unrelated JSX/CSS intact."
            )

        yield push_step("select_files", t("step_select_files", locale), "running")
        llm_messages = await build_llm_messages(
            project_id=project_id,
            history=[*history, ("user", task_prompt)],
            user_query=task_prompt,
            db=db,
            user_id=user_id,
            locale=locale,
            auth=auth,
            model=model,
            surgical_edit=surgical,
            # The plan names the files each task touches: guarantee their
            # current content is in the prompt, or the model rewrites them
            # from stale conversation memory.
            focus_paths=[str(f) for f in (task.get("files") or []) if isinstance(f, str)],
        )
        yield push_step("select_files", t("step_select_files", locale), "done")
        yield push_step("generate", t("step_generate", locale), "running")

        current_auth = await resolve_auth() if resolve_auth else auth
        task_buf: list[str] = []
        auth_retried = False
        network_retries = 0
        while True:
            try:
                async for chunk in stream_chat_completion(
                    auth=current_auth,
                    model=model,
                    messages=llm_messages,
                    locale=locale,
                ):
                    if run_id and is_cancelled(run_id):
                        task["status"] = "error"
                        await emit_progress(idx)
                        yield push_step("generate", t("step_generate", locale), "error")
                        yield _sse({"type": "error", "message": "cancelled", "plan": tasks})
                        return
                    if chunk.kind == "thinking":
                        thinking_parts.append(chunk.content)
                        yield _sse({"type": "thinking", "delta": chunk.content})
                    else:
                        task_buf.append(chunk.content)
                        full.append(chunk.content)
                        yield _sse({"type": "token", "content": chunk.content})
                break
            except RodiumError as exc:
                if not auth_retried and resolve_auth and exc.status_code in (401, 403):
                    auth_retried = True
                    current_auth = await resolve_auth()
                    # Drop partial tokens from this failed attempt.
                    if task_buf:
                        del full[-len(task_buf) :]
                    task_buf.clear()
                    continue
                if network_retries < 2 and is_transient_network_error(exc):
                    network_retries += 1
                    if task_buf:
                        del full[-len(task_buf) :]
                    task_buf.clear()
                    yield push_step(
                        "generate",
                        t("step_generate", locale),
                        "running",
                    )
                    continue
                task["status"] = "error"
                await emit_progress(idx)
                yield push_step("generate", t("step_generate", locale), "error")
                yield push_step(f"task:{tid}", title, "error")
                yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
                yield _sse({"type": "error", "message": str(exc), "plan": tasks})
                return
            except Exception as exc:
                task["status"] = "error"
                await emit_progress(idx)
                yield push_step("generate", t("step_generate", locale), "error")
                yield push_step(f"task:{tid}", title, "error")
                yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
                yield _sse(
                    {
                        "type": "error",
                        "message": str(exc)[:400] or t("step_generate", locale),
                        "plan": tasks,
                    }
                )
                return

        yield push_step("generate", t("step_generate", locale), "done")
        yield push_step("apply_writes", t("step_apply_writes", locale), "running")
        assistant_text = "".join(task_buf)
        writes, deletes = parse_forge_tags(assistant_text)
        written, violations = await apply_validated_writes_async(
            project_id, writes, snapshot_label=f"before: {title}"
        )
        applied.extend(written)
        for item in written:
            yield _sse({"type": "file_write", "path": item["path"]})
        for v in violations:
            yield _sse({"type": "warning", "message": f"{v.get('code')}: {v.get('message')}", "violation": v})
        for op in deletes:
            delete_file(project_id, op.path)
            applied.append({"op": "delete", "path": op.path})
            yield _sse({"type": "file_delete", "path": op.path})
        yield push_step("apply_writes", t("step_apply_writes", locale), "done")

        task["status"] = "done"
        await emit_progress(idx)
        yield push_step(f"task:{tid}", title, "done")
        yield _sse({"type": "plan_task", "id": tid, "status": "done", "label": title})

        # Mid-plan CSS/build check — catch orphan classes before the next rewrite.
        if len(tasks) >= 2 and tid != "coherence":
            from app.services.orchestration.verify_build import (
                format_css_second_pass_prompt,
                format_findings_for_prompt,
                repair_focus_paths,
                verify_project_build,
            )

            mid_findings = verify_project_build(project_id)
            critical_mid = [
                f
                for f in mid_findings
                if f.severity == "critical"
                and f.code in ("css.orphan_classes", "css.overflow_hidden_root", "entry.createRoot")
            ]
            for finding in critical_mid:
                yield _sse(
                    {
                        "type": "warning",
                        "message": (f"[verify-mid:{finding.severity}] {finding.code}: {finding.message}"),
                        "finding": finding.to_dict(),
                    }
                )
            if critical_mid:
                yield push_step("verify_repair_mid", "Repairing mid-plan CSS/build", "running")
                async for chunk in _stream_verify_repair(
                    project_id=project_id,
                    history=history,
                    user_prompt=user_prompt,
                    findings=critical_mid,
                    db=db,
                    user_id=user_id,
                    locale=locale,
                    auth=auth,
                    resolve_auth=resolve_auth,
                    run_id=run_id,
                    tasks=tasks,
                    applied=applied,
                    full=full,
                    thinking_parts=thinking_parts,
                    step_id="verify_repair_mid",
                    step_label="Repairing mid-plan CSS/build",
                    snapshot_label=f"before repair: {title}",
                    format_findings_for_prompt=format_findings_for_prompt,
                    push_step=push_step,
                    focus_paths=repair_focus_paths(critical_mid),
                ):
                    yield chunk
                recheck = [
                    f
                    for f in verify_project_build(project_id)
                    if f.severity == "critical" and f.code == "css.orphan_classes"
                ]
                if recheck:
                    yield push_step("verify_repair_mid2", "CSS repair pass 2", "running")
                    css_extra = format_css_second_pass_prompt(recheck)
                    async for chunk in _stream_verify_repair(
                        project_id=project_id,
                        history=history,
                        user_prompt=user_prompt,
                        findings=recheck,
                        db=db,
                        user_id=user_id,
                        locale=locale,
                        auth=auth,
                        resolve_auth=resolve_auth,
                        run_id=run_id,
                        tasks=tasks,
                        applied=applied,
                        full=full,
                        thinking_parts=thinking_parts,
                        step_id="verify_repair_mid2",
                        step_label="CSS repair pass 2",
                        snapshot_label=f"before css repair 2: {title}",
                        format_findings_for_prompt=format_findings_for_prompt,
                        push_step=push_step,
                        focus_paths=["src/index.css", "src/App.tsx"],
                        extra_prompt=css_extra,
                    ):
                        yield chunk
                    still = [
                        f
                        for f in verify_project_build(project_id)
                        if f.severity == "critical" and f.code == "css.orphan_classes"
                    ]
                    if still:
                        yield _sse(
                            {
                                "type": "warning",
                                "message": (
                                    "Warning: critical CSS orphans remain after 2 repair passes — "
                                    + still[0].message[:240]
                                ),
                                "finding": still[0].to_dict(),
                            }
                        )

        # Step-by-step mode: pause after each task so the user can review the
        # result and explicitly launch the next step from the plan panel.
        if step_mode:
            remaining = [t2 for t2 in tasks if str(t2.get("status") or "") != "done"]
            if remaining:
                if applied:
                    yield _sse({"type": "preview_refresh"})
                summary = to_plain_text(build_run_summary(tasks=tasks, applied=applied, locale=locale))
                yield _sse(
                    {
                        "type": "done",
                        "paused": True,
                        "applied": applied,
                        "summary": summary,
                        "assistant_content": "".join(full),
                        "thinking_text": "".join(thinking_parts) or None,
                        "steps": steps,
                        "plan": tasks,
                        "verify_findings": [],
                    }
                )
                return

    # Deterministic verify + optional repair (black-preview prevention)
    from app.services.orchestration.page_visit_check import page_route_findings
    from app.services.orchestration.smoke_check import smoke_transform_findings
    from app.services.orchestration.verify_build import (
        css_critical_findings,
        findings_have_critical,
        format_css_second_pass_prompt,
        format_findings_for_prompt,
        repair_focus_paths,
        verify_project_build,
    )

    yield push_step("verify_build", "Verifying build", "running")
    yield push_step("verify_pages", t("step_verify_pages", locale), "running")
    # Static heuristics + compile + named exports + route structure.
    findings = (
        verify_project_build(project_id)
        + await smoke_transform_findings(project_id)
        + page_route_findings(project_id)
    )
    for finding in findings:
        yield _sse(
            {
                "type": "warning",
                "message": f"[verify:{finding.severity}] {finding.code}: {finding.message}",
                "finding": finding.to_dict(),
            }
        )

    route_critical = any(f.severity == "critical" and f.code.startswith("route.") for f in findings)
    yield push_step(
        "verify_pages",
        t("step_verify_pages", locale),
        "error" if route_critical else "done",
    )

    if findings_have_critical(findings):
        yield push_step("verify_build", "Verifying build", "error")
        yield push_step("verify_repair", "Repairing verify findings", "running")
        async for chunk in _stream_verify_repair(
            project_id=project_id,
            history=history,
            user_prompt=user_prompt,
            findings=findings,
            db=db,
            user_id=user_id,
            locale=locale,
            auth=auth,
            resolve_auth=resolve_auth,
            run_id=run_id,
            tasks=tasks,
            applied=applied,
            full=full,
            thinking_parts=thinking_parts,
            step_id="verify_repair",
            step_label="Repairing verify findings",
            snapshot_label="before final repair",
            format_findings_for_prompt=format_findings_for_prompt,
            push_step=push_step,
            focus_paths=repair_focus_paths(findings),
        ):
            yield chunk

        findings = (
            verify_project_build(project_id)
            + await smoke_transform_findings(project_id)
            + page_route_findings(project_id)
        )
        if findings_have_critical(findings) and css_critical_findings(findings):
            yield push_step("verify_repair_css", "CSS repair pass 2", "running")
            css_findings = css_critical_findings(findings)
            css_extra = format_css_second_pass_prompt(findings)
            async for chunk in _stream_verify_repair(
                project_id=project_id,
                history=history,
                user_prompt=user_prompt,
                findings=css_findings,
                db=db,
                user_id=user_id,
                locale=locale,
                auth=auth,
                resolve_auth=resolve_auth,
                run_id=run_id,
                tasks=tasks,
                applied=applied,
                full=full,
                thinking_parts=thinking_parts,
                step_id="verify_repair_css",
                step_label="CSS repair pass 2",
                snapshot_label="before final css repair 2",
                format_findings_for_prompt=format_findings_for_prompt,
                push_step=push_step,
                focus_paths=["src/index.css", "src/App.tsx"],
                extra_prompt=css_extra,
            ):
                yield chunk
            findings = (
                verify_project_build(project_id)
                + await smoke_transform_findings(project_id)
                + page_route_findings(project_id)
            )

        for finding in findings:
            yield _sse(
                {
                    "type": "warning",
                    "message": f"[verify:{finding.severity}] {finding.code}: {finding.message}",
                    "finding": finding.to_dict(),
                }
            )
        route_critical = any(f.severity == "critical" and f.code.startswith("route.") for f in findings)
        yield push_step(
            "verify_pages",
            t("step_verify_pages", locale),
            "error" if route_critical else "done",
        )
        if findings_have_critical(findings):
            yield _sse(
                {
                    "type": "warning",
                    "message": (
                        "Critical verify findings remain — preview may stay black until "
                        "Context API / createRoot / CSS sync are fixed."
                    ),
                }
            )
            yield push_step("verify_build", "Verifying build", "error")
        else:
            yield push_step("verify_build", "Verifying build", "done")
    else:
        yield push_step("verify_build", "Verifying build", "done")

    if applied:
        # No dependency install and no dev server to bounce: the runner receives
        # the new source bundle straight from the browser on the next refresh.
        yield _sse({"type": "preview_refresh"})

    summary = to_plain_text(build_run_summary(tasks=tasks, applied=applied, locale=locale))
    if findings_have_critical(findings):
        summary = (
            summary + "\n\nWarning: critical build verify findings remain — preview may be black."
        ).strip()

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
            "verify_findings": [f.to_dict() for f in findings],
        }
    )
