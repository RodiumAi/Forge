"""The "Made with Forge" badge of published documents (plan section 8)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User
from app.services.entitlements import entitlements_apply, get_entitlements


def show_forge_badge(db: Session, user: User) -> bool:
    """Forge Cloud pages carry the badge unless the plan grants ``remove_badge``.

    Open-source and BYOK installs never show it.
    """
    if not entitlements_apply(user):
        return False
    row = get_entitlements(db, user)
    return not (row is not None and bool(row.remove_badge))
