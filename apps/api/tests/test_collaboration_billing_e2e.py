"""End-to-end collaboration billing journey (A → Z).

The whole story in one runnable test, using the REAL forge-web code paths:

  1. Owner creates an ``owner_pays`` project and INVITES a collaborator
     (real ``share_project``) → the default FRODI cap is applied.
  2. The collaborator runs several generations → they spend the OWNER's FRODI
     (real ``chats._generation_auth_resolver`` switches billing to the owner and
     attaches the cap; real ``llm._forge_billing_context`` builds the lane
     payload).
  3. The collaborator keeps going until the cap is hit → the reserve is refused,
     and the owner is never debited beyond the cap.
  4. The owner's Share panel shows the collaborator's spend this cycle
     (real ``list_collaborators``).
  5. The owner switches the project to ``each_pays_own`` → the collaborator now
     spends THEIR OWN FRODI, uncapped, and the owner is untouched.

forge-web and the gateway are separate services (and both use the package name
``app``), so the gateway is represented by a faithful in-test stand-in that runs
the exact cap arithmetic of ``reservation.reserve_frodi`` (deci-FRODI counter,
ceil rounding, refuse-over-cap) against an in-memory Redis + FRODI ledgers. That
arithmetic is separately unit-tested in
``rodiumai_fastapi/tests/gateway/test_frodi_collaborator_cap.py`` (10/10); here we
prove forge-web drives it correctly and the money reaches the right wallet.
"""

from __future__ import annotations

import math
import uuid
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.models import ProjectCollaborator, Project, User
from app.routers import chats as chats_mod
from app.routers import projects as projects_mod
from app.services.frodi_cycle import current_frodi_cycle_key
from app.services.rodium_generation import RodiumGenerationAuth

EN = {"Accept-Language": "en"}
DEFAULT_CAP = 2000


# ---------------------------------------------------------------------------
# The shared in-memory world (users + FRODI ledgers + project + collaborators)
# ---------------------------------------------------------------------------


class World:
    def __init__(self) -> None:
        self.owner = SimpleNamespace(
            id=uuid.uuid4(), email="owner@example.com", name="Owner", rodium_sub="owner_sub"
        )
        self.collab = SimpleNamespace(
            id=uuid.uuid4(), email="guest@example.com", name="Guest", rodium_sub="collab_sub"
        )
        self.project = SimpleNamespace(
            id=uuid.uuid4(),
            user_id=self.owner.id,
            billing_policy="owner_pays",
            visibility="private",
        )
        self.users = {str(self.owner.id): self.owner, str(self.collab.id): self.collab}
        self.collab_row: object | None = None  # ProjectCollaborator once shared
        # "NestJS" FRODI ledgers, by rodium_sub.
        self.frodi = {"owner_sub": 10_000.0, "collab_sub": 5_000.0}
        # "Redis" cap counter, deci-FRODI, keyed as the gateway keys it.
        self.cap_counter: dict[str, int] = {}


class CapReached(Exception):
    pass


class InsufficientFrodi(Exception):
    pass


def gateway_reserve(world: World, auth: RodiumGenerationAuth, quoted: float) -> None:
    """Faithful stand-in for the gateway FRODI reserve chokepoint.

    Mirrors ``request_context._frodi_collaborator_cap`` + ``reserve_frodi``:
    resolve the cap only for a non-owner actor, hold in deci-FRODI with ceil
    rounding, refuse if the hold would breach the ceiling, then debit the payer.
    """
    billing_uid = auth.billing_uid
    actor = auth.actor_uid
    ctx = _forge_ctx(auth)

    cap_key = None
    cap_limit = None
    if actor and actor != billing_uid and ctx:
        raw = ctx.get("cap_per_cycle")
        if raw not in (None, "", 0, "0"):
            cap_limit = int(raw)
            if cap_limit > 0:
                project = ctx.get("project_id") or "-"
                cycle = ctx.get("cycle_key") or "default"
                cap_key = f"frodi:capctr:{billing_uid}:{project}:{actor}:{cycle}"

    hold = math.ceil(quoted * 10)  # deci-FRODI, round up (never undercount)
    if cap_key and cap_limit:
        new_total = world.cap_counter.get(cap_key, 0) + hold
        if new_total > cap_limit * 10:
            raise CapReached()
        world.cap_counter[cap_key] = new_total

    if world.frodi.get(billing_uid, 0.0) < quoted:
        if cap_key:  # roll back the hold, like reserve_frodi does on a wallet 402
            world.cap_counter[cap_key] -= hold
        raise InsufficientFrodi()
    world.frodi[billing_uid] -= quoted


def _forge_ctx(auth: RodiumGenerationAuth):
    """Re-use the REAL forge-web builder for the lane billing context."""
    from app.services import llm as llm_mod

    return llm_mod._forge_billing_context(auth)


# ---------------------------------------------------------------------------
# Wiring: one fake DB shared by the projects router AND the chats resolver
# ---------------------------------------------------------------------------


def _fake_db(world: World):
    class Query:
        def __init__(self, *models):
            self.models = models

        def filter(self, *_a, **_k):
            return self

        def join(self, *_a, **_k):
            return self

        def order_by(self, *_a, **_k):
            return self

        def one_or_none(self):
            if self.models == (User,):
                return world.collab  # the single invitee looked up by email
            if self.models == (ProjectCollaborator,):
                return world.collab_row
            return None

        def all(self):
            return [(world.collab_row, world.collab)] if world.collab_row else []

    db = SimpleNamespace()
    db.query = lambda *models: Query(*models)

    def get(model, key):
        if model is Project:
            return world.project if str(key) == str(world.project.id) else None
        if model is User:
            return world.users.get(str(key))
        if model is ProjectCollaborator and isinstance(key, tuple):
            row = world.collab_row
            if row and (str(row.project_id), str(row.user_id)) == (str(key[0]), str(key[1])):
                return row
            return None
        return None

    def add(row):
        if isinstance(row, ProjectCollaborator):
            world.collab_row = row

    db.get = get
    db.add = add
    db.commit = lambda: None
    return db


def _client(monkeypatch, world: World):
    db = _fake_db(world)

    # projects router (share + list) talks to `db` via get_db.
    monkeypatch.setattr(
        projects_mod,
        "get_settings",
        lambda: SimpleNamespace(forge_default_collab_frodi_cap=DEFAULT_CAP, forge_cloud_enabled=True),
    )
    # list_collaborators reads cycle usage from the gateway → serve it from the
    # same cap counter the reserve stand-in writes.
    def _usage(owner_sub, project_id, actor_uids):
        cycle = current_frodi_cycle_key()
        out = {}
        for a in actor_uids:
            key = f"frodi:capctr:{owner_sub}:{project_id}:{a}:{cycle}"
            out[a] = round(world.cap_counter.get(key, 0) / 10, 1)
        return out

    monkeypatch.setattr(projects_mod, "_fetch_collab_usage", _usage)
    monkeypatch.setattr(projects_mod, "_notify_project_invite", lambda *_a, **_k: True)

    # chats resolver uses SessionLocal + resolve_generation_auth → same `db`.
    @contextmanager
    def fake_session():
        yield db

    monkeypatch.setattr(chats_mod, "SessionLocal", fake_session)

    async def fake_resolve(_db, fresh):
        return RodiumGenerationAuth(mode="secret", billing_uid=fresh.rodium_sub)

    monkeypatch.setattr(chats_mod, "resolve_generation_auth", fake_resolve)

    app = FastAPI()
    app.include_router(projects_mod.router)
    app.dependency_overrides[get_current_user] = lambda: world.owner
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app), db


async def _generate(world: World, actor: SimpleNamespace, quoted: float) -> None:
    """One collaborator generation: REAL resolve → REAL ctx → gateway reserve."""
    auth = await chats_mod._generation_auth_resolver(actor.id, "en", world.project.id)()
    gateway_reserve(world, auth, quoted)


# ---------------------------------------------------------------------------
# The journey
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_collaboration_billing_journey(monkeypatch):
    world = World()
    client, _ = _client(monkeypatch, world)

    # ── A. Owner invites the collaborator (owner_pays, no explicit cap) ──────
    r = client.post(
        f"/projects/{world.project.id}/share",
        json={"email": world.collab.email, "billing_policy": "owner_pays"},
        headers=EN,
    )
    assert r.status_code == 200
    assert r.json()["billing_policy"] == "owner_pays"
    assert r.json()["frodi_cap_per_cycle"] == DEFAULT_CAP  # default guardrail applied
    assert world.collab_row is not None

    owner_start = world.frodi["owner_sub"]
    collab_start = world.frodi["collab_sub"]

    # ── B. Collaborator generates → the OWNER pays ──────────────────────────
    for _ in range(3):
        await _generate(world, world.collab, quoted=500.0)
    assert world.frodi["owner_sub"] == owner_start - 1500  # 3 × 500 off the owner
    assert world.frodi["collab_sub"] == collab_start        # collaborator untouched

    # A 4th generation lands exactly on the 2000 cap (allowed).
    await _generate(world, world.collab, quoted=500.0)
    assert world.frodi["owner_sub"] == owner_start - 2000

    # ── C. The next generation would exceed the cap → refused ───────────────
    with pytest.raises(CapReached):
        await _generate(world, world.collab, quoted=500.0)
    assert world.frodi["owner_sub"] == owner_start - 2000  # owner NOT debited further

    # ── D. Owner's Share panel shows the collaborator's spend this cycle ─────
    rows = client.get(f"/projects/{world.project.id}/collaborators", headers=EN).json()
    guest = next(m for m in rows if m["email"] == world.collab.email)
    assert guest["frodi_cap_per_cycle"] == DEFAULT_CAP
    assert guest["frodi_used_this_cycle"] == 2000.0

    # ── E. Owner switches to each_pays_own → collaborator pays for THEMSELVES ─
    r = client.post(
        f"/projects/{world.project.id}/share",
        json={"email": world.collab.email, "billing_policy": "each_pays_own"},
        headers=EN,
    )
    assert r.status_code == 200
    assert r.json()["billing_policy"] == "each_pays_own"

    owner_before = world.frodi["owner_sub"]
    await _generate(world, world.collab, quoted=500.0)
    assert world.frodi["collab_sub"] == collab_start - 500  # collaborator's own FRODI
    assert world.frodi["owner_sub"] == owner_before          # owner untouched now

    # each_pays_own is uncapped — several more come straight off the collaborator.
    for _ in range(5):
        await _generate(world, world.collab, quoted=500.0)
    assert world.frodi["collab_sub"] == collab_start - 3000
    assert world.frodi["owner_sub"] == owner_before

    # ── Final ledger sanity ─────────────────────────────────────────────────
    assert world.frodi["owner_sub"] == 10_000 - 2000   # only the capped owner_pays spend
    assert world.frodi["collab_sub"] == 5_000 - 3000   # only the each_pays_own spend
