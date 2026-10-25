"""Who may create and use design systems: Forge Builder and above.

Open-source and BYOK installs (no entitlement cache) are unrestricted. On
Forge Cloud, Free and Starter are refused, whatever an old cache row says,
and an account with no synced plan counts as Free. The acting user's plan is
what counts.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.errors import SitesError
from app.models import User
from app.services.entitlements import entitlements_apply, get_entitlements

REQUIRED_PLAN = "builder"
DESIGN_SYSTEM_NOT_IN_PLAN = "DESIGN_SYSTEM_NOT_IN_PLAN"
_BELOW_BUILDER = {"free", "starter"}


def design_systems_allowed(db: Session, user: User) -> bool:
    if not entitlements_apply(user):
        return True
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    return row is not None and slug not in _BELOW_BUILDER


def require_design_systems(db: Session, user: User) -> None:
    """403 ``DESIGN_SYSTEM_NOT_IN_PLAN`` with the plan that unlocks it."""
    if design_systems_allowed(db, user):
        return
    raise SitesError(
        403,
        DESIGN_SYSTEM_NOT_IN_PLAN,
        "Design systems are included from the Builder plan.",
        {"feature": "design_system", "requiredPlan": REQUIRED_PLAN, "actions": ["upgrade"]},
    )
