"""What visitors of a published site send back: form submissions and visits.

Both arrive through the sites gateway on the site's own origin
(`/_rodium/v1/sites/...`), which forwards the visitor's Host as
`X-Rodium-Forwarded-Host`; a ZIP export calls the API directly with `?key=`,
an opaque per-project form key (a slug can change hands, a project id cannot).

Visits are counted without cookies or stored addresses: a visitor is a daily
salted hash of IP + user agent, kept in Redis for two days (in-process when
Redis is down) only to tell a new visitor from a returning one.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import logging
import re
import threading
import time
from collections import OrderedDict
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import FormSubmission, Project

logger = logging.getLogger(__name__)

MAX_FIELDS = 40
MAX_KEY_CHARS = 64
MAX_VALUE_CHARS = 5_000
MAX_PAYLOAD_CHARS = 32_000
# Distinct paths counted per site and day; the rest is pooled under OTHER_PATH.
MAX_PATHS_PER_DAY = 200
OTHER_PATH = "(other)"
HONEYPOT_KEYS = frozenset({"_gotcha", "_hp", "website_url_hp", "bot_field"})
_BOT_UA_RE = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget", re.I
)
_FORM_NAME_RE = re.compile(r"[^a-z0-9_-]+")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_seen_lock = threading.Lock()
_seen_local: OrderedDict[str, float] = OrderedDict()
_SEEN_MAX = 50_000
_redis_lock = threading.Lock()
_redis_client = None


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


# ── Form key (ZIP exports) ─────────────────────────────────────────────────


def _key_mac(raw: bytes) -> bytes:
    secret = get_settings().secret_key.encode()
    return hmac.new(secret, b"forge-forms:" + raw, hashlib.sha256).digest()[:10]


def project_form_key(project_id: UUID) -> str:
    raw = project_id.bytes
    return base64.urlsafe_b64encode(raw + _key_mac(raw)).decode().rstrip("=")


def project_from_form_key(db: Session, key: str | None) -> Project | None:
    """The project a form key was issued for (published or not), or None."""
    if not key or len(key) > 64:
        return None
    try:
        blob = base64.urlsafe_b64decode(key + "=" * (-len(key) % 4))
    except (ValueError, TypeError):
        return None
    if len(blob) != 26 or not hmac.compare_digest(blob[16:], _key_mac(blob[:16])):
        return None
    return db.get(Project, UUID(bytes=blob[:16]))


# ── Visitors ───────────────────────────────────────────────────────────────


def visitor_ip(request: Request) -> str:
    """The visitor's address.

    Behind the sites gateway every request comes from the gateway itself; it
    forwards the visitor address in `X-Forge-Visitor-IP`, trusted only with the
    shared `SITES_GATEWAY_SECRET`. Otherwise the usual proxy-aware client IP.
    """
    from app.services.rate_limit import _client_ip

    secret = get_settings().sites_gateway_secret
    if secret:
        sent = request.headers.get("x-forge-gateway-secret", "")
        forwarded = request.headers.get("x-forge-visitor-ip", "").strip()
        if forwarded and hmac.compare_digest(sent.encode(), secret.encode()):
            try:
                return str(ipaddress.ip_address(forwarded))
            except ValueError:
                pass
    return _client_ip(request)


def rate_subject(ip: str) -> str:
    """Rate-limit identity: one IPv4 address, or one IPv6 /64 (a household)."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if addr.version == 6:
        return str(ipaddress.ip_network(f"{addr}/64", strict=False).network_address) + "/64"
    return str(addr)


def visitor_hash(ip: str, user_agent: str, day: str) -> str:
    secret = get_settings().secret_key
    return hashlib.sha256(f"{secret}|{day}|{ip}|{user_agent}".encode()).hexdigest()[:24]


def is_bot(user_agent: str) -> bool:
    return not user_agent or bool(_BOT_UA_RE.search(user_agent))


def _clean_text(value: str, limit: int) -> str:
    # Postgres text refuses NUL; other control characters are noise.
    return _CONTROL_RE.sub("", value)[:limit]


def clean_submission(form: object, data: object) -> tuple[str, dict[str, str]] | None:
    """Normalised (form name, fields), or None when the payload is unusable."""
    name = _FORM_NAME_RE.sub("-", str(form or "form").strip().lower())[:MAX_KEY_CHARS].strip("-") or "form"
    if not isinstance(data, dict) or not data:
        return None
    fields: dict[str, str] = {}
    for key, value in list(data.items())[:MAX_FIELDS]:
        k = _clean_text(str(key).strip(), MAX_KEY_CHARS)
        if not k:
            continue
        if isinstance(value, (list, tuple)):
            value = ", ".join(str(v) for v in value)
        elif isinstance(value, dict):
            value = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, bool):
            value = "yes" if value else "no"
        fields[k] = _clean_text("" if value is None else str(value), MAX_VALUE_CHARS)
    if not fields or len(json.dumps(fields, ensure_ascii=False)) > MAX_PAYLOAD_CHARS:
        return None
    return name, fields


def is_honeypot_hit(fields: dict[str, str]) -> bool:
    return any(fields.get(k, "").strip() for k in HONEYPOT_KEYS)


def clean_path(path: str) -> str:
    raw = (path or "/").split("?")[0].split("#")[0]
    return _clean_text("/" + raw.lstrip("/"), 300)


def store_submission(
    db: Session, project: Project, *, form: str, fields: dict[str, str], page: str, visitor: str
):
    visible = {k: v for k, v in fields.items() if k not in HONEYPOT_KEYS}
    row = FormSubmission(
        project_id=project.id,
        form_name=form,
        data_json=json.dumps(visible, ensure_ascii=False),
        page=_clean_text(page or "", 300),
        visitor_hash=visitor[:32],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _redis():
    """One shared client (connection pool) with short timeouts, or None."""
    global _redis_client
    if _redis_client is None:
        with _redis_lock:
            if _redis_client is None:
                try:
                    import redis

                    _redis_client = redis.Redis.from_url(
                        get_settings().redis_url, socket_timeout=0.5, socket_connect_timeout=0.5
                    )
                except Exception:
                    return None
    return _redis_client


def _first_visit_today(project_id: UUID, day: str, visitor: str) -> bool:
    key = f"forge:uv:{project_id}:{day}"
    client = _redis()
    if client is not None:
        try:
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
    """One page view (+1 unique visitor when first seen today)."""
    day = datetime.now(UTC).date().isoformat()
    unique = 1 if _first_visit_today(project.id, day, visitor) else 0
    page = clean_path(path)
    params = {"project_id": str(project.id), "day": day}
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
        {**params, "id": str(uuid4()), "user_id": str(project.user_id), "unique": unique},
    )
    # Paths are visitor-supplied: past MAX_PATHS_PER_DAY distinct ones a day,
    # new ones are pooled so a script cannot grow the table without bound.
    updated = db.execute(
        text(
            "UPDATE site_page_days SET views = views + 1 WHERE project_id = :project_id AND day = :day AND path = :path"
        ),
        {**params, "path": page},
    ).rowcount
    if not updated:
        distinct = db.execute(
            text("SELECT count(*) FROM site_page_days WHERE project_id = :project_id AND day = :day"),
            params,
        ).scalar_one()
        if distinct >= MAX_PATHS_PER_DAY:
            page = OTHER_PATH
        db.execute(
            text(
                """
                INSERT INTO site_page_days (id, project_id, day, path, views)
                VALUES (:id, :project_id, :day, :path, 1)
                ON CONFLICT (project_id, day, path) DO UPDATE SET views = site_page_days.views + 1
                """
            ),
            {**params, "id": str(uuid4()), "path": page},
        )
    db.commit()
