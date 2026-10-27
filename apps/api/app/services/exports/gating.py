"""Who may export a document, and when the "Made with Forge" badge shows.

Plan 8: Free exports nothing; PDF and PNG from Starter (``export_pdf``);
HTML and PPTX from Builder (``export_html``, ``export_pptx``). Open-source
and BYOK installs (no entitlement cache) are unrestricted and show no badge.

As in ``require_feature``, the plan slug wins over a stale cache row: a Free
account never exports and a Starter account never gets HTML or PPTX, whatever
an old row says. The acting user's plan counts, on a shared project too.
A format is included from its plan upward: a plan ranked at or above the one
that unlocks it gets it even when its entitlements lack the flag (Pro, Scale,
the team plans).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.errors import SitesError
from app.models import User
from app.services.entitlements import entitlements_apply, get_entitlements

#: Export format to the entitlement column that unlocks it.
EXPORT_FLAGS: dict[str, str] = {
    "pdf": "export_pdf",
    "png": "export_pdf",
    "html": "export_html",
    "pptx": "export_pptx",
}
#: Lowest plan that includes each flag (shown by the client in the upgrade prompt).
REQUIRED_PLAN: dict[str, str] = {"export_pdf": "starter", "export_html": "builder", "export_pptx": "builder"}
_NEVER: dict[str, set[str]] = {
    "export_pdf": {"free"},
    "export_html": {"free", "starter"},
    "export_pptx": {"free", "starter"},
}

#: Plan order, the same as the client's (lib/forge-plans.ts). Unknown slugs
#: rely on their flag alone.
PLAN_RANK: dict[str, int] = {
    "free": 0,
    "starter": 1,
    "builder": 2,
    "pro": 3,
    "scale": 4,
    "team-pro": 10,
    "team-scale": 11,
}

EXPORT_NOT_IN_PLAN = "EXPORT_NOT_IN_PLAN"


def plan_reaches(slug: str, required: str) -> bool:
    """Whether ``slug`` is ``required`` or a plan above it."""
    rank = PLAN_RANK.get(slug)
    return rank is not None and rank >= PLAN_RANK[required]


def export_allowed(db: Session, user: User, fmt: str) -> bool:
    flag = EXPORT_FLAGS.get(fmt)
    if flag is None:
        return False
    if not entitlements_apply(user):
        return True
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    if slug in _NEVER[flag]:
        return False
    if row is None:
        return False
    return bool(getattr(row, flag, False)) or plan_reaches(slug, REQUIRED_PLAN[flag])


def require_export(db: Session, user: User, fmt: str) -> None:
    """403 ``EXPORT_NOT_IN_PLAN`` with the format and the plan that unlocks it."""
    if export_allowed(db, user, fmt):
        return
    flag = EXPORT_FLAGS.get(fmt, "export_pdf")
    raise SitesError(
        403,
        EXPORT_NOT_IN_PLAN,
        f"{fmt.upper()} export is not included in the current Forge plan.",
        {"format": fmt, "feature": flag, "requiredPlan": REQUIRED_PLAN[flag], "actions": ["upgrade"]},
    )


def can_remove_badge(db: Session, user: User) -> bool:
    if not entitlements_apply(user):
        return True
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    return slug != "free" and row is not None and bool(row.remove_badge)


def show_badge(db: Session, user: User, requested: bool | None) -> bool:
    """Badge on a published deck or an HTML export.

    Accounts that may remove it get it only when they ask for it (``True``);
    everyone else always gets it. Open-source installs never add it unasked.
    """
    if can_remove_badge(db, user):
        return bool(requested)
    return True
