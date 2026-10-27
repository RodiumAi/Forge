"""Design systems as reusable records: ownership, team sharing, defaults, versions.

A design system is a ``design_system`` project; its row in ``design_systems``
says who may use it. Rules:

* the owner of the project (and its accepted collaborators) read it; editors
  and the owner edit it, as for any project;
* shared with a team (``visibility="team"``), every member of that team reads
  and attaches it, and the team admin (the team owner) may edit it and choose
  it as the team default;
* only the owner shares or makes it their personal default; sharing needs the
  ``design_system_sharing`` right on Forge Cloud (open source: always allowed).

A team is identified by its owner's user id, the same key ``team_seats`` uses.
Rows are created lazily, so projects that predate the table, forks of a
template and projects created by older clients all show up.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Iterable
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.errors import SitesError
from app.kinds import resolve_kind
from app.models import DesignSystemRecord, Project, ProjectCollaborator, TeamSeat, User
from app.services.document_scaffold import DESIGN_SYSTEM_PATH
from app.services.filesystem import content_version, read_file

KIND = "design_system"
HOLDING_SEATS = ("pending", "accepted", "removed", "restore")


def _uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


# ── teams ──────────────────────────────────────────────────────────────────


def team_ids(db: Session, user: User) -> set[uuid.UUID]:
    """Teams the user belongs to: their own (as owner) and every accepted seat."""
    out = {_uuid(user.id)}
    email = (getattr(user, "email", "") or "").strip().lower()
    if email:
        for seat in db.query(TeamSeat).filter(TeamSeat.email == email, TeamSeat.status == "accepted").all():
            out.add(_uuid(seat.owner_user_id))
    return out


def sharing_team(db: Session, user: User) -> uuid.UUID | None:
    """The team a design system of ``user`` is shared with, None without a team.

    A team owner (any seat offered) shares with their own team; a member
    shares with the team that seated them.
    """
    owns = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == user.id, TeamSeat.status.in_(HOLDING_SEATS))
        .first()
    )
    if owns is not None:
        return _uuid(user.id)
    email = (getattr(user, "email", "") or "").strip().lower()
    seat = (
        db.query(TeamSeat)
        .filter(TeamSeat.email == email, TeamSeat.status == "accepted")
        .order_by(TeamSeat.created_at.desc())
        .first()
    )
    return _uuid(seat.owner_user_id) if seat is not None else None


# ── rows and versions ──────────────────────────────────────────────────────


def get_record(db: Session, project_id: Any) -> DesignSystemRecord | None:
    return db.get(DesignSystemRecord, _uuid(project_id))


def ensure_record(db: Session, project: Project) -> DesignSystemRecord:
    """The row of a design_system project, created on first sight."""
    row = db.get(DesignSystemRecord, _uuid(project.id))
    if row is None:
        row = DesignSystemRecord(
            project_id=_uuid(project.id),
            owner_user_id=_uuid(project.user_id),
            visibility="private",
            is_default_user=False,
            is_default_team=False,
            version=1,
            content_hash=content_version(str(project.id), DESIGN_SYSTEM_PATH) or None,
        )
        db.add(row)
        db.flush()
    return row


def refresh_version(row: DesignSystemRecord) -> int:
    """Bump ``version`` when design-system.json changed since it was last seen."""
    current = content_version(str(row.project_id), DESIGN_SYSTEM_PATH) or None
    if current and current != row.content_hash:
        if row.content_hash:
            row.version = int(row.version or 1) + 1
        row.content_hash = current
    return int(row.version or 1)


def read_document(project_id: Any) -> dict[str, Any] | None:
    try:
        data = json.loads(read_file(str(project_id), DESIGN_SYSTEM_PATH))
    except (FileNotFoundError, ValueError, OSError):
        return None
    return data if isinstance(data, dict) else None


# ── access ─────────────────────────────────────────────────────────────────


def _collaborator(db: Session, project: Project, user: User) -> ProjectCollaborator | None:
    row = db.get(ProjectCollaborator, (project.id, user.id))
    if row is not None and row.accepted_at is not None:
        return row
    return None


def _team_member(db: Session, user: User, row: DesignSystemRecord | None) -> bool:
    return bool(
        row is not None
        and row.visibility == "team"
        and row.team_id is not None
        and _uuid(row.team_id) in team_ids(db, user)
    )


def is_team_admin(user: User, row: DesignSystemRecord | None) -> bool:
    return bool(
        row is not None and row.visibility == "team" and row.team_id and _uuid(row.team_id) == _uuid(user.id)
    )


def access(db: Session, user: User, project: Project) -> tuple[bool, bool]:
    """(can read, can edit) ``project`` as a design system."""
    if _uuid(project.user_id) == _uuid(user.id):
        return True, True
    collab = _collaborator(db, project, user)
    row = get_record(db, project.id)
    can_edit = bool(collab is not None and collab.role == "editor") or is_team_admin(user, row)
    can_read = can_edit or collab is not None or _team_member(db, user, row)
    return can_read, can_edit


def design_system_project(db: Session, user: User, project_id: Any, *, require_edit: bool = False) -> Project:
    """A design_system project the user may read (or edit), else 404 / 400."""
    try:
        pid = _uuid(project_id)
    except (TypeError, ValueError) as exc:
        raise SitesError(404, "DESIGN_SYSTEM_NOT_FOUND", "Design system not found.") from exc
    project = db.get(Project, pid)
    if project is None:
        raise SitesError(404, "DESIGN_SYSTEM_NOT_FOUND", "Design system not found.")
    can_read, can_edit = access(db, user, project)
    if not can_read or (require_edit and not can_edit):
        raise SitesError(404, "DESIGN_SYSTEM_NOT_FOUND", "Design system not found.")
    if resolve_kind(project.platform) != KIND:
        raise SitesError(400, "NOT_A_DESIGN_SYSTEM", "This project is not a design system.")
    return project


# ── listing ────────────────────────────────────────────────────────────────


def preview(document: dict[str, Any] | None) -> dict[str, Any]:
    """Five colours and the two font families, for pickers and cards."""
    tokens = (document or {}).get("tokens") or {}
    colors = []
    for name, token in (tokens.get("color") or {}).items():
        if name.startswith("$") or not isinstance(token, dict):
            continue
        if isinstance(token.get("$value"), str) and len(colors) < 5:
            colors.append(token["$value"])

    def family(role: str) -> str | None:
        value = ((tokens.get("font") or {}).get(role) or {}).get("$value")
        if isinstance(value, list) and value:
            return str(value[0])
        return str(value).split(",")[0].strip() if isinstance(value, str) else None

    return {"colors": colors, "display": family("display"), "body": family("body")}


def _item(db: Session, user: User, project: Project, row: DesignSystemRecord, owners: dict) -> dict[str, Any]:
    mine = _uuid(project.user_id) == _uuid(user.id)
    _can_read, can_edit = access(db, user, project)
    team_scope = (
        row.visibility == "team" and row.team_id is not None and _uuid(row.team_id) in team_ids(db, user)
    )
    owner = owners.get(_uuid(project.user_id))
    return {
        "id": str(project.id),
        "name": project.name,
        "scope": "personal" if mine else ("team" if team_scope else "shared"),
        "visibility": row.visibility,
        "team_id": str(row.team_id) if row.team_id else None,
        "owner": {
            "id": str(project.user_id),
            "name": (getattr(owner, "name", None) or None) if owner else None,
            "mine": mine,
        },
        "is_default_user": bool(row.is_default_user) and mine,
        "is_default_team": bool(row.is_default_team) and team_scope,
        "can_edit": can_edit,
        "can_share": mine,
        "can_set_team_default": is_team_admin(user, row),
        "version": int(row.version or 1),
        "updated_at": (project.updated_at.isoformat() if getattr(project, "updated_at", None) else None),
        "preview": preview(read_document(project.id)),
    }


def list_for_user(db: Session, user: User) -> list[dict[str, Any]]:
    """Mine, shared with me as a collaborator, and my teams' ones; default first."""
    own = (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.platform == KIND, Project.status != "locked")
        .all()
    )
    collab_ids = [
        row.project_id
        for row in db.query(ProjectCollaborator)
        .filter(ProjectCollaborator.user_id == user.id, ProjectCollaborator.accepted_at.isnot(None))
        .all()
    ]
    shared = (
        db.query(Project).filter(Project.id.in_(collab_ids), Project.platform == KIND).all()
        if collab_ids
        else []
    )
    teams = list(team_ids(db, user))
    team_rows = (
        db.query(DesignSystemRecord)
        .filter(DesignSystemRecord.visibility == "team", DesignSystemRecord.team_id.in_(teams))
        .all()
    )
    team_projects = (
        db.query(Project)
        .filter(Project.id.in_([r.project_id for r in team_rows]), Project.platform == KIND)
        .all()
        if team_rows
        else []
    )
    seen: dict[uuid.UUID, Project] = {}
    for project in [*own, *shared, *team_projects]:
        seen.setdefault(_uuid(project.id), project)
    owners = {
        _uuid(u.id): u
        for u in (
            db.query(User).filter(User.id.in_({_uuid(p.user_id) for p in seen.values()})).all()
            if seen
            else []
        )
    }
    items = []
    for project in seen.values():
        row = ensure_record(db, project)
        refresh_version(row)
        items.append(_item(db, user, project, row, owners))
    db.commit()

    def weight(item: dict[str, Any]) -> int:
        if item["is_default_user"]:
            return 0
        return 1 if item["is_default_team"] else 2

    # Newest first, then (stable sort) my default, the team default, the rest.
    items.sort(key=lambda item: item["updated_at"] or "", reverse=True)
    items.sort(key=weight)
    return items


def item_for(db: Session, user: User, project: Project) -> dict[str, Any]:
    row = ensure_record(db, project)
    refresh_version(row)
    owner = db.get(User, project.user_id)
    return _item(db, user, project, row, {_uuid(project.user_id): owner} if owner else {})


# ── defaults and sharing ───────────────────────────────────────────────────


def _clear(rows: Iterable[DesignSystemRecord], field: str, keep: uuid.UUID) -> None:
    for other in rows:
        if _uuid(other.project_id) != keep and getattr(other, field):
            setattr(other, field, False)


def set_default(db: Session, user: User, project: Project, *, scope: str, value: bool) -> DesignSystemRecord:
    row = ensure_record(db, project)
    if scope == "user":
        if _uuid(project.user_id) != _uuid(user.id):
            raise SitesError(403, "NOT_OWNER", "Only the owner can make this design system their default.")
        if value:
            _clear(
                db.query(DesignSystemRecord).filter(DesignSystemRecord.owner_user_id == user.id).all(),
                "is_default_user",
                _uuid(project.id),
            )
            db.flush()
        row.is_default_user = value
    elif scope == "team":
        if not is_team_admin(user, row):
            raise SitesError(403, "NOT_TEAM_ADMIN", "Only the team admin chooses the team default.")
        if value:
            _clear(
                db.query(DesignSystemRecord).filter(DesignSystemRecord.team_id == row.team_id).all(),
                "is_default_team",
                _uuid(project.id),
            )
            db.flush()
        row.is_default_team = value
    else:
        raise SitesError(400, "INVALID_SCOPE", "The scope is user or team.")
    db.commit()
    return row


def share(db: Session, user: User, project: Project) -> DesignSystemRecord:
    from app.services.entitlements import require_feature

    if _uuid(project.user_id) != _uuid(user.id):
        raise SitesError(403, "NOT_OWNER", "Only the owner can share this design system.")
    require_feature(db, user, "design_system_sharing")
    team = sharing_team(db, user)
    if team is None:
        raise SitesError(409, "NO_TEAM", "Invite people to your team before sharing a design system.")
    row = ensure_record(db, project)
    if row.team_id is not None and _uuid(row.team_id) != team:
        row.is_default_team = False
    row.visibility = "team"
    row.team_id = team
    db.commit()
    return row


def unshare(db: Session, user: User, project: Project) -> DesignSystemRecord:
    row = ensure_record(db, project)
    if _uuid(project.user_id) != _uuid(user.id) and not is_team_admin(user, row):
        raise SitesError(403, "NOT_OWNER", "Only the owner or the team admin can stop sharing.")
    row.visibility = "private"
    row.team_id = None
    row.is_default_team = False
    db.commit()
    return row


def default_for(db: Session, user: User) -> uuid.UUID | None:
    """The design system a new project gets when the user picked none."""
    mine = (
        db.query(DesignSystemRecord)
        .filter(DesignSystemRecord.owner_user_id == user.id, DesignSystemRecord.is_default_user.is_(True))
        .first()
    )
    if mine is not None:
        return _uuid(mine.project_id)
    team = (
        db.query(DesignSystemRecord)
        .filter(
            DesignSystemRecord.is_default_team.is_(True),
            DesignSystemRecord.visibility == "team",
            or_(*[DesignSystemRecord.team_id == t for t in team_ids(db, user)]),
        )
        .first()
    )
    return _uuid(team.project_id) if team is not None else None
