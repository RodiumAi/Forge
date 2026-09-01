"""Optional post-scaffold / on-demand security review (Forge-inspired)."""

from __future__ import annotations

from app.i18n import Locale
from app.prompts.system import SECURITY_REVIEW_SYSTEM_PROMPT
from app.services.filesystem import list_files
from app.services.llm import RodiumError, complete_chat
from app.services.rodium_generation import RodiumGenerationAuth

_REVIEW_PATHS = (
    "src/App.tsx",
    "src/main.tsx",
    "src/lib",
    ".env.example",
)


def _gather_review_corpus(project_id: str, *, max_chars: int = 40_000) -> str:
    files = list_files(project_id)
    parts: list[str] = []
    used = 0
    for path in sorted(files.keys()):
        pl = path.lower()
        if not (
            pl.endswith((".ts", ".tsx", ".js", ".jsx", ".env.example", ".md"))
            or any(pl.startswith(p.lower()) for p in ("src/lib", "src/components"))
        ):
            continue
        if "node_modules" in pl:
            continue
        content = files[path]
        chunk = f"\n--- {path} ---\n{content[:8000]}\n"
        if used + len(chunk) > max_chars:
            break
        parts.append(chunk)
        used += len(chunk)
    return "".join(parts)


async def run_security_review(
    *,
    project_id: str,
    auth: RodiumGenerationAuth,
    model: str,
    locale: Locale = "en",
) -> str:
    corpus = _gather_review_corpus(project_id)
    if not corpus.strip():
        return "No material findings."
    try:
        return await complete_chat(
            auth=auth,
            model=model,
            messages=[
                {"role": "system", "content": SECURITY_REVIEW_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "Review this generated site codebase for security issues:\n" + corpus,
                },
            ],
            locale=locale,
            temperature=0.1,
        )
    except (RodiumError, Exception) as exc:
        return f"Security review unavailable: {str(exc)[:200]}"
