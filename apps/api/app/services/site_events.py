"""What visitors of a published site send back: form submissions and visits.

Both arrive through the sites gateway on the site's own origin
(`/_rodium/v1/sites/...`), which forwards the visitor's Host as
`X-Rodium-Forwarded-Host`; a ZIP export calls the API directly with `?site=`.

Visits are counted without cookies or stored addresses: a visitor is a daily
salted hash of IP + user agent, kept in Redis for two days (in-process when
Redis is down) only to tell a new visitor from a returning one.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from collections import OrderedDict
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import FormSubmission, Project

logger = logging.getLogger(__name__)

MAX_FIELDS = 40
MAX_KEY_CHARS = 64
MAX_VALUE_CHARS = 5_000
MAX_PAYLOAD_CHARS = 32_000
HONEYPOT_KEYS = frozenset({"_gotcha", "_hp", "website_url_hp", "bot_field"})
_BOT_UA_RE = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget", re.I
)
_FORM_NAME_RE = re.compile(r"[^a-z0-9_-]+")

_seen_lock = threading.Lock()
_seen_local: OrderedDict[str, float] = OrderedDict()
_SEEN_MAX = 50_000


def slug_for_host(host: str) -> str | None:
    """Site slug served on `host`: slug subdomain or validated custom domain."""
    from app.routers.sites_v1 import _parse_hostname, _resolve_slug

    try:
        hostname = _parse_hostname(host)
    except Exception:
        return None
    if not hostname:
        return None
    base = get_settings().sites_base_domain.split(":")[0].lower()
    if hostname.endswith("." + base):
        label = hostname[: -(len(base) + 1)]
        return label if label and "." not in label else None
    return _resolve_slug(hostname)


def published_project(db: Session, slug: str | None) -> Project | None:
    if not slug:
        return None
    project = db.query(Project).filter(Project.slug == slug).first()
    if project is None or project.published_at is None:
        return None
    return project


def visitor_hash(ip: str, user_agent: str, day: str) -> str:
    secret = get_settings().secret_key
    return hashlib.sha256(f"{secret}|{day}|{ip}|{user_agent}".encode()).hexdigest()[:24]


def is_bot(user_agent: str) -> bool:
    return not user_agent or bool(_BOT_UA_RE.search(user_agent))


def clean_submission(form: object, data: object) -> tuple[str, dict[str, str]] | None:
    """Normalised (form name, fields), or None when the payload is unusable."""
    name = _FORM_NAME_RE.sub("-", str(form or "form").strip().lower())[:MAX_KEY_CHARS].strip("-") or "form"
    if not isinstance(data, dict) or not data:
        return None
    fields: dict[str, str] = {}
    for key, value in list(data.items())[:MAX_FIELDS]:
        k = str(key).strip()[:MAX_KEY_CHARS]
        if not k:
            continue
        if isinstance(value, (list, tuple)):
            value = ", ".join(str(v) for v in value)
        elif isinstance(value, dict):
            value = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, bool):
            value = "yes" if value else "no"
        fields[k] = ("" if value is None else str(value))[:MAX_VALUE_CHARS]
    if not fields or len(json.dumps(fields, ensure_ascii=False)) > MAX_PAYLOAD_CHARS:
        return None
    return name, fields


def is_honeypot_hit(fields: dict[str, str]) -> bool:
    return any(fields.get(k, "").strip() for k in HONEYPOT_KEYS)


def store_submission(
    db: Session, project: Project, *, form: str, fields: dict[str, str], page: str, visitor: str
):
    visible = {k: v for k, v in fields.items() if k not in HONEYPOT_KEYS}
    row = FormSubmission(
        project_id=project.id,
        form_name=form,
        data_json=json.dumps(visible, ensure_ascii=False),
        page=(page or "")[:300],
        visitor_hash=visitor[:32],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _first_visit_today(project_id: UUID, day: str, visitor: str) -> bool:
    key = f"forge:uv:{project_id}:{day}"
    try:
        import redis

        client = redis.Redis.from_url(get_settings().redis_url, socket_timeout=0.5)
        pipe = client.pipeline()
        pipe.sadd(key, visitor)
        pipe.expire(key, 172_800)
        added, _ = pipe.execute()
        return bool(added)
    except Exception:
        pass
    local_key = f"{key}:{visitor}"
    now = time.time()
    with _seen_lock:
        if local_key in _seen_local:
            return False
        _seen_local[local_key] = now
        while len(_seen_local) > _SEEN_MAX:
            _seen_local.popitem(last=False)
    return True


def record_visit(db: Session, project: Project, *, path: str, visitor: str) -> None:
    """One page view (+1 unique visitor when first seen today), atomically."""
    from uuid import uuid4

    day = datetime.now(UTC).date().isoformat()
    unique = 1 if _first_visit_today(project.id, day, visitor) else 0
    clean_path = ("/" + (path or "/").split("?")[0].split("#")[0].lstrip("/"))[:300]
    db.execute(
        text(
            """
            INSERT INTO site_usage_days (id, user_id, project_id, day, emails_sent, storage_bytes,
                                         page_views, unique_visitors)
            VALUES (:id, :user_id, :project_id, :day, 0, 0, 1, :unique)
            ON CONFLICT (user_id, project_id, day) DO UPDATE
               SET page_views = site_usage_days.page_views + 1,
                   unique_visitors = site_usage_days.unique_visitors + :unique
            """
        ),
        {
            "id": str(uuid4()),
            "user_id": str(project.user_id),
            "project_id": str(project.id),
            "day": day,
            "unique": unique,
        },
    )
    db.execute(
        text(
            """
            INSERT INTO site_page_days (id, project_id, day, path, views)
            VALUES (:id, :project_id, :day, :path, 1)
            ON CONFLICT (project_id, day, path) DO UPDATE SET views = site_page_days.views + 1
            """
        ),
        {"id": str(uuid4()), "project_id": str(project.id), "day": day, "path": clean_path},
    )
    db.commit()
