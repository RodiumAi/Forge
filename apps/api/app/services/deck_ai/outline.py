"""The deck outline: what the user validates before any slide is written.

The outline travels through the existing plan confirmation: each slide is a
plan task (``id`` = the future slide id) shown in the PlanPanel, the full
outline rides in ``plan_meta_json["deck"]`` and is echoed as a
``deck.outline`` event. On confirm, the tasks the user kept (and their order
and titles) decide the deck that gets written.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.contracts.forge_design import ID_PATTERN
from app.services.deck_ai.layouts import normalize_layout

MAX_SLIDES = 30
_ID_RE = re.compile(ID_PATTERN)


class OutlineSlide(BaseModel):
    id: str = ""
    title: str = Field(default="", max_length=200)
    idea: str = Field(default="", max_length=600)
    layout: str = "text"
    visual: bool = False

    @field_validator("title", "idea", mode="before")
    @classmethod
    def _trim(cls, value: Any) -> str:
        return str(value or "").strip()[:600]

    @field_validator("layout", mode="before")
    @classmethod
    def _layout(cls, value: Any) -> str:
        return normalize_layout(value)

    @field_validator("visual", mode="before")
    @classmethod
    def _visual(cls, value: Any) -> bool:
        return value is True or str(value).lower() in ("true", "yes", "1")


class Outline(BaseModel):
    title: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=1000)
    format: Literal["16:9", "4:3", "1:1"] = "16:9"
    slides: list[OutlineSlide] = Field(min_length=1, max_length=MAX_SLIDES)

    @field_validator("title", "summary", mode="before")
    @classmethod
    def _trim(cls, value: Any) -> str:
        return str(value or "").strip()[:1000]

    @field_validator("format", mode="before")
    @classmethod
    def _format(cls, value: Any) -> str:
        text = str(value or "").strip()
        return text if text in ("16:9", "4:3", "1:1") else "16:9"


def check_outline(data: dict[str, Any]) -> Outline:
    """Validate a model outline and give its slides the ids s1, s2, ..."""
    slides = data.get("slides")
    if isinstance(slides, list) and len(slides) > MAX_SLIDES:
        data = {**data, "slides": slides[:MAX_SLIDES]}
    outline = Outline.model_validate(data)
    for index, slide in enumerate(outline.slides, start=1):
        slide.id = f"s{index}"
        if not slide.title:
            raise ValueError(f"slides.{index - 1}.title is empty")
    if not outline.title:
        outline.title = outline.slides[0].title
    return outline


def plan_tasks(outline: Outline) -> list[dict[str, Any]]:
    """The outline as PlanPanel tasks (``id``, ``title``, ``status`` plus deck fields)."""
    return [
        {
            "id": slide.id,
            "title": slide.title,
            "status": "pending",
            "detail": slide.idea,
            "layout": slide.layout,
            "visual": slide.visual,
        }
        for slide in outline.slides
    ]


def outline_from_plan(stored: dict[str, Any] | None, tasks: list[dict[str, Any]] | None) -> Outline:
    """The outline to write, from the stored one and the tasks the user confirmed.

    Tasks keep their order; a task removed by the user drops its slide; an
    edited title, idea or layout wins; a task the outline does not know becomes
    a new slide from its title.
    """
    base = Outline.model_validate(stored) if stored else None
    known = {slide.id: slide for slide in base.slides} if base else {}
    if not tasks:
        if base is None:
            raise ValueError("no outline to write")
        return base
    slides: list[OutlineSlide] = []
    for task in tasks[:MAX_SLIDES]:
        if not isinstance(task, dict):
            continue
        source = known.get(str(task.get("id") or ""))
        title = str(task.get("title") or (source.title if source else "")).strip()
        if not title:
            continue
        task_id = str(task.get("id") or "")
        slides.append(
            OutlineSlide(
                id=task_id if _ID_RE.match(task_id) else "",
                title=title,
                idea=str(task.get("detail") or (source.idea if source else "")),
                layout=task.get("layout") or (source.layout if source else "text"),
                visual=task.get("visual", source.visual if source else False),
            )
        )
    if not slides:
        raise ValueError("the confirmed plan has no slide")
    # Keep the task ids (the PlanPanel tracks progress by them); give the
    # others, and duplicates, a fresh one.
    used: set[str] = set()
    counter = 0
    for slide in slides:
        if not slide.id or slide.id in used:
            counter += 1
            while f"s{counter}" in used or f"s{counter}" in {s.id for s in slides}:
                counter += 1
            slide.id = f"s{counter}"
        used.add(slide.id)
    return Outline(
        title=base.title if base else slides[0].title,
        summary=base.summary if base else "",
        format=base.format if base else "16:9",
        slides=slides,
    )
