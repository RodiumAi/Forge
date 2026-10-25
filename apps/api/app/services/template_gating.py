"""Which kits a Forge plan may start a project from.

Free gets the kits marked ``"free": true`` in their template.json (two per
kind); every other kit starts at Starter. Design system kits follow the
design system rule (Builder, ``design_system.gating``), checked separately.

Open-source and BYOK installs (no entitlement cache) are unrestricted. On
Forge Cloud an account with no synced plan counts as Free. Previews and kit
details stay public: only creating a project is refused.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.errors import SitesError
from app.models import User
from app.services.entitlements import entitlements_apply, get_entitlements
from app.services.templates import TemplateMeta

TEMPLATE_NOT_IN_PLAN = "TEMPLATE_NOT_IN_PLAN"


def template_allowed(db: Session, user: User, meta: TemplateMeta) -> bool:
    if meta.free or meta.kind == "design_system" or not entitlements_apply(user):
        return True
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    return row is not None and slug != "free"


def require_template(db: Session, user: User, meta: TemplateMeta) -> None:
    """403 ``TEMPLATE_NOT_IN_PLAN`` with the plan that unlocks the kit."""
    if template_allowed(db, user, meta):
        return
    raise SitesError(
        403,
        TEMPLATE_NOT_IN_PLAN,
        "This template is included from the Starter plan.",
        {"feature": "template", "templateId": meta.id, "requiredPlan": "starter", "actions": ["upgrade"]},
    )
