"""Project kinds: one registry instead of ``in ("web", "mobile")`` everywhere.

``Project.platform`` stores the kind id. ``web`` and ``mobile`` are React code
written by the agent (``engine="react"``); ``slides``, ``codelab`` and
``design_system`` are documents rendered by a fixed Forge player
(``engine="document"``, contracts in ``app/contracts``). The document kinds
ship dark: each one is gated by a settings flag that defaults to off.

``apps/web/lib/kinds.ts`` mirrors this table.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from app.prompts.system import MOBILE_PLATFORM_RULES

KindId = Literal["web", "mobile", "slides", "codelab", "design_system"]
Engine = Literal["react", "document"]
Editor = Literal["builder", "deck", "codelab", "design_system"]
PublishMode = Literal["site", "deck_player", "codelab_player", "design_system_site"]

DEFAULT_KIND: KindId = "web"


@dataclass(frozen=True)
class ProjectKind:
    id: KindId
    #: react = code written by the agent, document = data + a Forge player.
    engine: Engine
    #: ``scaffold(project_id, app_name, **options)`` writes the starting files.
    #: Options are kind specific (``ratio`` for slides) and ignored elsewhere.
    scaffold: Callable[..., None]
    #: Appended to the system prompt for this kind (empty = none).
    prompt_rules: str
    #: Starter kit used as the quality reference when none was forked.
    default_kit: str
    editor: Editor
    exports: tuple[str, ...]
    publish: PublishMode
    #: How prompts name the deliverable ("website", "mobile app").
    label: str
    #: ``Settings`` attribute that must be true for the kind to be offered.
    #: ``None`` = always available.
    flag: str | None = None


def _scaffold_web(project_id: str, app_name: str, **_options: object) -> None:
    from app.services.scaffold import scaffold_vite_react

    scaffold_vite_react(project_id, app_name, "web")


def _scaffold_mobile(project_id: str, app_name: str, **_options: object) -> None:
    from app.services.scaffold import scaffold_vite_react

    scaffold_vite_react(project_id, app_name, "mobile")


def _scaffold_slides(project_id: str, app_name: str, *, ratio: str | None = None, **_options: object) -> None:
    from app.services.document_scaffold import scaffold_slides

    scaffold_slides(project_id, app_name, ratio=ratio or "16:9")


def _scaffold_codelab(project_id: str, app_name: str, **_options: object) -> None:
    from app.services.document_scaffold import scaffold_codelab

    scaffold_codelab(project_id, app_name)


def _scaffold_design_system(project_id: str, app_name: str, **_options: object) -> None:
    from app.services.document_scaffold import scaffold_design_system

    scaffold_design_system(project_id, app_name)


_KINDS: tuple[ProjectKind, ...] = (
    ProjectKind(
        id="web",
        engine="react",
        scaffold=_scaffold_web,
        prompt_rules="",
        default_kit="aurora-ai",
        editor="builder",
        exports=("zip",),
        publish="site",
        label="website",
    ),
    ProjectKind(
        id="mobile",
        engine="react",
        scaffold=_scaffold_mobile,
        prompt_rules=MOBILE_PLATFORM_RULES,
        default_kit="lumen-wallet",
        editor="builder",
        exports=("zip",),
        publish="site",
        label="mobile app",
    ),
    ProjectKind(
        id="slides",
        engine="document",
        scaffold=_scaffold_slides,
        prompt_rules="",
        default_kit="",
        editor="deck",
        exports=("pdf", "png", "pptx", "html"),
        publish="deck_player",
        label="presentation",
        flag="forge_kind_slides_enabled",
    ),
    ProjectKind(
        id="codelab",
        engine="document",
        scaffold=_scaffold_codelab,
        prompt_rules="",
        default_kit="",
        editor="codelab",
        exports=("md", "pdf", "zip"),
        publish="codelab_player",
        label="codelab",
        flag="forge_kind_codelab_enabled",
    ),
    ProjectKind(
        id="design_system",
        engine="document",
        scaffold=_scaffold_design_system,
        prompt_rules="",
        default_kit="",
        editor="design_system",
        exports=("tokens", "css", "tailwind", "pdf"),
        publish="design_system_site",
        label="design system",
        flag="forge_kind_design_system_enabled",
    ),
)

KINDS: dict[str, ProjectKind] = {kind.id: kind for kind in _KINDS}
KIND_IDS: tuple[str, ...] = tuple(KINDS)


def get_kind(kind_id: object) -> ProjectKind | None:
    """The registered kind for ``kind_id`` (case and spaces ignored), else None."""
    if not isinstance(kind_id, str):
        return None
    return KINDS.get(kind_id.strip().lower())


def resolve_kind(raw: object, fallback: str = DEFAULT_KIND) -> str:
    """A registered kind id; anything else becomes ``fallback``."""
    kind = get_kind(raw)
    return kind.id if kind is not None else fallback


def kind_enabled(kind_id: object) -> bool:
    kind = get_kind(kind_id)
    if kind is None:
        return False
    if kind.flag is None:
        return True
    from app.config import get_settings

    return bool(getattr(get_settings(), kind.flag, False))


def all_kinds() -> tuple[ProjectKind, ...]:
    return _KINDS


def react_kind_ids() -> tuple[str, ...]:
    """Kinds built as React code: the ones starter kits and the builder serve."""
    return tuple(kind.id for kind in _KINDS if kind.engine == "react")


def react_kind(raw: object) -> str:
    """``raw`` when it is a React kind, else the default kind.

    For code paths that only make sense for generated React (kits, scaffolds,
    the builder prompt): a document kind falls back to ``web``, as any unknown
    value always did.
    """
    kind = get_kind(raw)
    return kind.id if kind is not None and kind.engine == "react" else DEFAULT_KIND
