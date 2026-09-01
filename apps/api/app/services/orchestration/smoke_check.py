"""Post-plan smoke transform — the server compiles what the browser would run.

The static heuristics in verify_build catch structural mistakes, but the only
authoritative answer to "will the preview be blank?" is running the exact
transform pipeline the runner uses. This calls the runtime CLI in --check
mode (same Babel transform, same module resolution, same import-map
allowlist, project dependencies included) and converts every error into a
critical finding for the existing repair pass — the Cursor-style
self-correction loop, without needing a headless browser.
"""

from __future__ import annotations

import asyncio
import json
import logging

from app.services.orchestration.verify_build import VerifyFinding
from app.services.preview_babel import collect_project_source_files
from app.services.publish_esm import runtime_dir

logger = logging.getLogger(__name__)

_CHECK_TIMEOUT_S = 60


async def smoke_transform_findings(project_id: str) -> list[VerifyFinding]:
    """Compile the project exactly like the runner; errors become findings.

    Best effort: if node/the CLI is unavailable the check silently yields
    nothing rather than blocking the plan.
    """
    cli = runtime_dir() / "cli.mjs"
    if not cli.is_file():
        return []

    files = collect_project_source_files(project_id)
    source = {k: v for k, v in files.items() if k.endswith((".tsx", ".ts", ".jsx", ".js", ".css"))}
    if "src/main.tsx" not in source:
        return []  # entry.missing is already reported by verify_build

    try:
        from app.services.project_packages import extra_import_map

        extra = extra_import_map(project_id)
    except Exception:
        extra = {}

    payload = json.dumps(
        {"files": source, "entry": "src/main.tsx", "extraImports": extra},
        ensure_ascii=False,
    )
    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(cli),
            "--check",
            cwd=str(runtime_dir()),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(payload.encode("utf-8")), _CHECK_TIMEOUT_S)
        result = json.loads(stdout.decode("utf-8"))
    except Exception as exc:
        logger.warning("smoke transform unavailable for %s: %s", project_id, exc)
        return []

    if result.get("ok"):
        return []

    findings: list[VerifyFinding] = []
    for err in result.get("errors") or []:
        if not isinstance(err, dict):
            continue
        path = str(err.get("path") or "src/main.tsx")
        message = str(err.get("message") or "transform failed")
        line = err.get("line")
        loc = f" (line {line})" if line else ""
        if message.startswith("EXPORT_NOT_FOUND:"):
            findings.append(
                VerifyFinding(
                    code="export.named_missing",
                    severity="critical",
                    path=path,
                    message=(
                        f"Named export missing{loc}: {message[:400]} — the preview WILL "
                        "fail at runtime until this import is fixed."
                    ),
                )
            )
        else:
            findings.append(
                VerifyFinding(
                    code="transform.error",
                    severity="critical",
                    path=path,
                    message=(
                        f"The app does not compile{loc}: {message[:400]} — the preview WILL be "
                        "blank until this is fixed. Rewrite the failing file completely."
                    ),
                )
            )
        if len(findings) >= 10:
            break
    return findings
