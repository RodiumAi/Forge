"""The codelab outline: what the user validates before any step is written.

It travels through the existing plan confirmation, like the deck outline:
each step is a plan task (``id`` = the future step id) shown in the plan
panel, the full outline rides in ``plan_meta_json["codelab"]`` and is echoed
as a ``codelab.outline`` event. On confirm, the tasks the user kept (their
order, titles, details and minutes) decide the codelab that gets written.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.services.codelab.store import slugify, unique_step_id

MAX_STEPS = 30


class OutlineStep(BaseModel):
    id: str = ""
    title: str = Field(default="", max_length=200)
    idea: str = Field(default="", max_length=800)
    minutes: int = 5

    @field_validator("title", "idea", mode="before")
    @classmethod
    def _trim(cls, value: Any) -> str:
        return str(value or "").strip()[:800]

    @field_validator("minutes", mode="before")
    @classmethod
    def _minutes(cls, value: Any) -> int:
        try:
            return max(1, min(60, round(float(value))))
        except (TypeError, ValueError):
            return 5


class OutlineFiles(BaseModel):
    starter: bool = False
    solution: bool = False


class Outline(BaseModel):
    title: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=2000)
    level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    prerequisites: list[str] = Field(default_factory=list)
    learn: list[str] = Field(default_factory=list)
    steps: list[OutlineStep] = Field(min_length=1, max_length=MAX_STEPS)
    files: OutlineFiles = Field(default_factory=OutlineFiles)

    @field_validator("title", "summary", mode="before")
    @classmethod
    def _trim(cls, value: Any) -> str:
        return str(value or "").strip()[:2000]

    @field_validator("level", mode="before")
    @classmethod
    def _level(cls, value: Any) -> str:
        text = str(value or "").strip().lower()
        return text if text in ("beginner", "intermediate", "advanced") else "beginner"

    @field_validator("prerequisites", "learn", mode="before")
    @classmethod
    def _items(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip()[:300] for item in value if str(item).strip()][:30]

    @field_validator("files", mode="before")
    @classmethod
    def _files(cls, value: Any) -> Any:
        return value if isinstance(value, dict) else {}


def _assign_ids(outline: Outline) -> Outline:
    taken: set[str] = set()
    for step in outline.steps:
        step.id = unique_step_id(step.id or step.title, taken)
        taken.add(step.id)
    return outline


def check_outline(data: dict[str, Any]) -> Outline:
    """Validate a model outline and give its steps ids derived from their titles."""
    steps = data.get("steps")
    if isinstance(steps, list) and len(steps) > MAX_STEPS:
        data = {**data, "steps": steps[:MAX_STEPS]}
    outline = Outline.model_validate(data)
    for index, step in enumerate(outline.steps):
        if not step.title:
            raise ValueError(f"steps.{index}.title is empty")
        step.id = ""
    if not outline.title:
        outline.title = outline.steps[0].title
    return _assign_ids(outline)


def plan_tasks(outline: Outline) -> list[dict[str, Any]]:
    return [
        {
            "id": step.id,
            "title": step.title,
            "status": "pending",
            "detail": step.idea,
            "minutes": step.minutes,
        }
        for step in outline.steps
    ]


def outline_from_plan(stored: Any, plan: list[dict] | None) -> Outline:
    """The outline after confirmation: the stored one, reshaped by the edited plan.

    Tasks may be reordered, deleted or retitled; unknown ids become new steps.
    """
    base = Outline.model_validate(stored) if isinstance(stored, dict) else None
    if not plan:
        if base is None:
            raise ValueError("no outline")
        return base
    known = {step.id: step for step in (base.steps if base else [])}
    steps: list[OutlineStep] = []
    used: set[str] = set()
    for task in plan[:MAX_STEPS]:
        if not isinstance(task, dict):
            continue
        title = str(task.get("title") or "").strip()
        if not title:
            continue
        task_id = str(task.get("id") or "")
        previous = known.get(task_id) if task_id not in used else None
        used.add(task_id)
        steps.append(
            OutlineStep(
                id=previous.id if previous else "",
                title=title,
                idea=str(task.get("detail") or (previous.idea if previous else "")),
                minutes=task.get("minutes") or (previous.minutes if previous else 5),
            )
        )
    if not steps:
        raise ValueError("empty plan")
    outline = Outline(
        title=base.title if base else steps[0].title,
        summary=base.summary if base else "",
        level=base.level if base else "beginner",
        prerequisites=base.prerequisites if base else [],
        learn=base.learn if base else [],
        steps=steps,
        files=base.files if base else OutlineFiles(),
    )
    # Kept steps keep their ids; new ones get one from their title.
    taken = {step.id for step in outline.steps if step.id}
    for step in outline.steps:
        if not step.id:
            step.id = unique_step_id(slugify(step.title), taken)
            taken.add(step.id)
    return outline
