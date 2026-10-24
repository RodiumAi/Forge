"""Which flow and which models a chat message on a document project uses."""

from __future__ import annotations

from app.config import get_settings
from app.kinds import get_kind, kind_enabled
from app.services.orchestration.router import EFFORT_LABELS, Route

#: Document kinds whose AI flow lives in this package (codelab: wave 2). The
#: design_system flow is in ``services/design_system`` (see ``chat_entry``).
AI_READY_KINDS = frozenset({"slides"})


def document_kind(platform: object) -> str | None:
    """The kind id when ``platform`` is a document kind, else None (React kinds)."""
    kind = get_kind(platform)
    if kind is None or kind.engine != "document":
        return None
    return kind.id


def ai_available(kind_id: str) -> bool:
    return kind_id in AI_READY_KINDS and kind_enabled(kind_id)


def deck_routes() -> tuple[Route, Route]:
    """(writing route, small-edit route) before plan entitlements.

    Outline and writing use the escalation model when escalation is on (the
    stronger writer); small targeted edits use the default model. The caller
    runs both through the plan's tier entitlements, which downgrade a refused
    escalation to the default model.
    """
    settings = get_settings()
    default = (settings.effective_default_model or "").strip() or "google/gemini-3.7-flash"
    escalation = (settings.effective_escalation_model or "").strip()
    if settings.enable_pro_escalation and escalation:
        writing = Route("deck.generate", escalation, "escalation", EFFORT_LABELS["escalation"])
    else:
        writing = Route("deck.generate", default, "primary", EFFORT_LABELS["primary"])
    editing = Route("deck.edit", default, "primary", EFFORT_LABELS["primary"])
    return writing, editing
