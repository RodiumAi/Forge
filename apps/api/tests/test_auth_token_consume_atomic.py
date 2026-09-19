"""Atomic auth-token consume — concurrent clicks must not both succeed."""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime, timedelta

from app.models import AuthToken
from app.services import auth_tokens


def _matches(row, predicate) -> bool:
    from sqlalchemy.sql import operators
    from sqlalchemy.sql.elements import Null

    op = getattr(predicate, "operator", None)
    left = getattr(predicate, "left", None)
    if left is None:
        return False
    column = left.name
    actual = getattr(row, column)
    right = getattr(predicate, "right", None)

    if op is operators.is_:
        if right is None or isinstance(right, Null):
            return actual is None
        return actual is getattr(right, "value", right)
    if op is operators.isnot:
        if right is None or isinstance(right, Null):
            return actual is not None
        return actual is not getattr(right, "value", right)
    value = getattr(right, "value", right) if right is not None else None
    if op is operators.ge:
        if actual is None or value is None:
            return False
        if getattr(actual, "tzinfo", None) is None and getattr(value, "tzinfo", None) is not None:
            actual = actual.replace(tzinfo=value.tzinfo)
        return actual >= value
    return actual == value


class _FakeTokenQuery:
    def __init__(self, rows: list[AuthToken]):
        self._rows = rows

    def filter(self, *predicates):
        return _FakeTokenQuery([row for row in self._rows if all(_matches(row, p) for p in predicates)])

    def first(self):
        return self._rows[0] if self._rows else None

    def update(self, values, synchronize_session=False):
        updated = 0
        for row in self._rows:
            if "consumed_at" in {getattr(col, "name", None) for col in values} and row.consumed_at is not None:
                continue
            for column, value in values.items():
                setattr(row, column.name, value)
            updated += 1
        return updated


class _FakeSession:
    def __init__(self):
        self.rows: list[AuthToken] = []

    def add(self, row):
        if row.consumed_at is None:
            row.consumed_at = None
        self.rows.append(row)

    def flush(self):
        pass

    def query(self, _model):
        return _FakeTokenQuery(list(self.rows))


def test_consume_is_single_winner_under_concurrent_calls():
    db = _FakeSession()
    user_id = uuid.uuid4()
    raw = auth_tokens.issue_password_reset(db, user_id)
    lock = threading.Lock()
    results: list[uuid.UUID | None] = []

    original_query = db.query

    def locked_query(model):
        q = original_query(model)
        original_update = q.update

        def update(values, synchronize_session=False):
            with lock:
                return original_update(values, synchronize_session=synchronize_session)

        q.update = update  # type: ignore[method-assign]
        return q

    db.query = locked_query  # type: ignore[method-assign]

    barrier = threading.Barrier(2)

    def race() -> None:
        barrier.wait(timeout=5)
        results.append(auth_tokens.consume(db, raw, AuthToken.KIND_PASSWORD_RESET))

    threads = [threading.Thread(target=race) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    winners = [r for r in results if r is not None]
    assert len(results) == 2
    assert len(winners) == 1
    assert winners[0] == user_id
    assert db.rows[0].consumed_at is not None


def test_consume_refuses_expired_even_when_unconsumed():
    db = _FakeSession()
    raw = auth_tokens.issue_email_verify(db, uuid.uuid4())
    db.rows[0].expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) is None
    assert db.rows[0].consumed_at is None
