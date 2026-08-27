"""Firestore live mirror for the Forge builder UI (preview, publish, run, files).

Postgres remains the durable source of truth. All mirror writes go through a
single background worker thread: callers enqueue and return immediately, so a
missing/unreachable emulator can never stall a request or an SSE generator.
(The previous version claimed fire-and-forget but performed synchronous gRPC
`.set()` calls inline — with the emulator down, each call blocked its caller
for the full 60s retry window, freezing the whole API during generations.)

A circuit breaker disables the mirror for a cool-down after consecutive
failures instead of paying the connection timeout on every single write.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger("firestore_live")

_app_lock = threading.Lock()
_app_ready = False
_db = None
_last_run_write_mono: dict[str, float] = {}
_RUN_THROTTLE_S = 0.2

# Per-RPC budget: a mirror write is worthless if it takes longer than this.
_RPC_TIMEOUT_S = 5.0

# --- background dispatcher ---------------------------------------------------
_queue: queue.Queue[tuple[str, Callable[[], None]]] = queue.Queue(maxsize=500)
_worker_lock = threading.Lock()
_worker_started = False
_consecutive_failures = 0
_FAILURES_BEFORE_TRIP = 3
_BREAKER_COOLDOWN_S = 120.0
_disabled_until = 0.0
_breaker_notified = False

# Local-only signing material for Auth emulator custom tokens (NOT for production).
_EMULATOR_SA_CANDIDATES = (
    Path("/srv/infra/firebase-admin-emulator.json"),  # Docker mount
    Path(__file__).resolve().parents[3] / "infra" / "local" / "firebase-admin-emulator.json",
    Path("/tmp/firebase-admin-emulator.json"),
)


def _worker() -> None:
    global _consecutive_failures, _disabled_until, _breaker_notified
    while True:
        label, task = _queue.get()
        try:
            if time.monotonic() < _disabled_until:
                continue  # breaker open: drop silently
            task()
            if _consecutive_failures:
                _consecutive_failures = 0
                _breaker_notified = False
                logger.info("Firestore mirror recovered")
        except Exception as exc:
            _consecutive_failures += 1
            if _consecutive_failures >= _FAILURES_BEFORE_TRIP:
                _disabled_until = time.monotonic() + _BREAKER_COOLDOWN_S
                if not _breaker_notified:
                    _breaker_notified = True
                    logger.warning(
                        "Firestore mirror disabled for %.0fs after %d failures (%s: %s). "
                        "Start the emulator or set FIRESTORE_ENABLED=false.",
                        _BREAKER_COOLDOWN_S,
                        _consecutive_failures,
                        label,
                        str(exc)[:200],
                    )
            else:
                logger.warning("Firestore mirror %s failed: %s", label, str(exc)[:200])
        finally:
            _queue.task_done()


def _dispatch(label: str, task: Callable[[], None]) -> None:
    """Enqueue a mirror write; never blocks, never raises."""
    global _worker_started
    if not enabled():
        return
    if time.monotonic() < _disabled_until:
        return
    if not _worker_started:
        with _worker_lock:
            if not _worker_started:
                threading.Thread(target=_worker, name="firestore-mirror", daemon=True).start()
                _worker_started = True
    try:
        _queue.put_nowait((label, task))
    except queue.Full:
        logger.debug("Firestore mirror queue full — dropping %s", label)


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _using_emulator() -> bool:
    return bool(os.environ.get("FIRESTORE_EMULATOR_HOST") or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"))


def enabled() -> bool:
    settings = get_settings()
    if not settings.firestore_enabled:
        return False
    if _using_emulator():
        return True
    return bool(settings.google_application_credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))


def _emulator_sa_path() -> Path:
    for path in _EMULATOR_SA_CANDIDATES:
        if path.is_file():
            return path
    # Prefer writable host path; Docker mounts ./infra/local as :ro → fall back to /tmp.
    host = _EMULATOR_SA_CANDIDATES[1]
    try:
        host.parent.mkdir(parents=True, exist_ok=True)
        return host
    except OSError:
        return Path("/tmp/firebase-admin-emulator.json")


def _ensure_emulator_sa() -> Path:
    """Ensure a local service-account JSON exists for Admin Auth custom tokens."""
    path = _emulator_sa_path()
    if path.is_file():
        return path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        path = Path("/tmp/firebase-admin-emulator.json")
        path.parent.mkdir(parents=True, exist_ok=True)
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except Exception as exc:
        raise RuntimeError("cryptography is required to mint local Firebase Auth tokens") from exc

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    settings = get_settings()
    payload = {
        "type": "service_account",
        "project_id": settings.firebase_project_id,
        "private_key_id": "forge-local-emulator",
        "private_key": pem,
        "client_email": f"firebase-adminsdk@{settings.firebase_project_id}.iam.gserviceaccount.com",
        "client_id": "000000000000000000000",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.warning("Generated local emulator service account at %s (dev only)", path)
    return path


def _open_firestore_client(project_id: str, database_id: str):
    """Open Firestore client; use anonymous creds against the emulator."""
    from google.cloud.firestore import Client as FirestoreClient

    if _using_emulator():
        from google.auth.credentials import AnonymousCredentials

        return FirestoreClient(
            project=project_id,
            credentials=AnonymousCredentials(),
            database=database_id,
        )
    return FirestoreClient(project=project_id, database=database_id)


def _ensure_app() -> bool:
    global _app_ready, _db
    if not enabled():
        return False
    if _app_ready and _db is not None:
        return True
    with _app_lock:
        if _app_ready and _db is not None:
            return True
        try:
            import firebase_admin
            from firebase_admin import credentials

            settings = get_settings()
            project_id = settings.firebase_project_id
            database_id = settings.firestore_database or "(default)"

            if settings.google_application_credentials:
                os.environ.setdefault(
                    "GOOGLE_APPLICATION_CREDENTIALS",
                    settings.google_application_credentials,
                )

            if not firebase_admin._apps:
                opts = {"projectId": project_id}
                if _using_emulator():
                    sa = _ensure_emulator_sa()
                    cred = credentials.Certificate(str(sa))
                    firebase_admin.initialize_app(cred, options=opts)
                elif settings.google_application_credentials and os.path.isfile(
                    settings.google_application_credentials
                ):
                    cred = credentials.Certificate(settings.google_application_credentials)
                    firebase_admin.initialize_app(cred, options=opts)
                else:
                    firebase_admin.initialize_app(options=opts)

            try:
                _db = _open_firestore_client(project_id, database_id)
            except Exception:
                if database_id != "(default)":
                    logger.warning(
                        "Firestore database %s failed — falling back to (default)",
                        database_id,
                    )
                    _db = _open_firestore_client(project_id, "(default)")
                else:
                    raise

            _app_ready = True
            logger.info(
                "Firestore live ready project=%s db=%s emulator=%s",
                project_id,
                database_id,
                _using_emulator(),
            )
            return True
        except Exception:
            logger.exception("Firestore live init failed")
            _app_ready = False
            _db = None
            return False


def create_custom_token(uid: str) -> str:
    """Mint a Firebase Auth custom token for the Forge user (uid = user.id)."""
    if not _ensure_app():
        raise RuntimeError("Firestore is not enabled")
    from firebase_admin import auth

    token = auth.create_custom_token(uid)
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return str(token)


def _project_ref(project_id: str):
    assert _db is not None
    return _db.collection("forge_projects").document(project_id)


def _live_ref(project_id: str, doc_id: str):
    return _project_ref(project_id).collection("live").document(doc_id)


def _user_project_ref(owner_user_id: str, project_id: str):
    assert _db is not None
    return _db.collection("forge_users").document(owner_user_id).collection("projects").document(project_id)


def ensure_project(project_id: str, owner_user_id: str, *, name: str | None = None) -> None:
    def task() -> None:
        if not _ensure_app():
            return
        data: dict[str, Any] = {
            "owner_user_id": str(owner_user_id),
            "updated_at": _utc_now(),
        }
        if name:
            data["name"] = name
        _project_ref(project_id).set(data, merge=True, retry=None, timeout=_RPC_TIMEOUT_S)

    _dispatch("ensure_project", task)


def _mirror_dashboard_sync(
    owner_user_id: str,
    project_id: str,
    *,
    name: str | None = None,
    preview_status: str | None = None,
    published_at: str | None = None,
    active_run_status: str | None = None,
) -> None:
    patch: dict[str, Any] = {"updated_at": _utc_now()}
    if name is not None:
        patch["name"] = name
    if preview_status is not None:
        patch["preview_status"] = preview_status
    if published_at is not None:
        patch["published_at"] = published_at
    if active_run_status is not None:
        patch["active_run_status"] = active_run_status
    _user_project_ref(str(owner_user_id), project_id).set(
        patch, merge=True, retry=None, timeout=_RPC_TIMEOUT_S
    )


def mirror_dashboard(
    owner_user_id: str,
    project_id: str,
    *,
    name: str | None = None,
    preview_status: str | None = None,
    published_at: str | None = None,
    active_run_status: str | None = None,
) -> None:
    if not owner_user_id:
        return

    def task() -> None:
        if not _ensure_app():
            return
        _mirror_dashboard_sync(
            owner_user_id,
            project_id,
            name=name,
            preview_status=preview_status,
            published_at=published_at,
            active_run_status=active_run_status,
        )

    _dispatch("mirror_dashboard", task)


def set_preview(
    project_id: str,
    *,
    status: str,
    owner_user_id: str | None = None,
    port: int | None = None,
    url: str | None = None,
    public_url: str | None = None,
    error: str | None = None,
    name: str | None = None,
) -> None:
    def task() -> None:
        if not _ensure_app():
            return
        payload: dict[str, Any] = {
            "status": status,
            "updated_at": _utc_now(),
        }
        if port is not None:
            payload["port"] = port
        if url is not None:
            payload["url"] = url
        if public_url is not None:
            payload["public_url"] = public_url
        if error is not None:
            payload["error"] = error
        elif status != "error":
            payload["error"] = None
        _live_ref(project_id, "preview").set(payload, merge=True, retry=None, timeout=_RPC_TIMEOUT_S)
        if owner_user_id:
            _mirror_dashboard_sync(owner_user_id, project_id, name=name, preview_status=status)

    _dispatch("set_preview", task)


def set_publish(
    project_id: str,
    *,
    phase: str,
    owner_user_id: str | None = None,
    job_id: str | None = None,
    message: str | None = None,
    published_at: str | None = None,
    name: str | None = None,
) -> None:
    def task() -> None:
        if not _ensure_app():
            return
        payload: dict[str, Any] = {
            "phase": phase,
            "updated_at": _utc_now(),
        }
        if job_id is not None:
            payload["job_id"] = job_id
        if message is not None:
            payload["message"] = message
        if published_at is not None:
            payload["published_at"] = published_at
        _live_ref(project_id, "publish").set(payload, merge=True, retry=None, timeout=_RPC_TIMEOUT_S)
        if owner_user_id and published_at is not None:
            _mirror_dashboard_sync(owner_user_id, project_id, name=name, published_at=published_at)

    _dispatch("set_publish", task)


def set_run(
    project_id: str,
    *,
    run_id: str | None,
    status: str,
    owner_user_id: str | None = None,
    step_id: str | None = None,
    step_label: str | None = None,
    name: str | None = None,
    throttle: bool = True,
) -> None:
    # Throttle BEFORE enqueueing: run updates fire on every SSE step and the
    # queue must not fill up with duplicates.
    if throttle:
        now = time.monotonic()
        last = _last_run_write_mono.get(project_id, 0.0)
        if now - last < _RUN_THROTTLE_S and status == "running":
            return
        _last_run_write_mono[project_id] = now

    def task() -> None:
        if not _ensure_app():
            return
        payload: dict[str, Any] = {
            "run_id": run_id,
            "status": status,
            "updated_at": _utc_now(),
        }
        if step_id is not None:
            payload["step_id"] = step_id
        if step_label is not None:
            payload["step_label"] = step_label
        _live_ref(project_id, "run").set(payload, merge=True, retry=None, timeout=_RPC_TIMEOUT_S)
        if owner_user_id:
            _mirror_dashboard_sync(owner_user_id, project_id, name=name, active_run_status=status)

    _dispatch("set_run", task)


def bump_files(
    project_id: str,
    paths: list[str],
    *,
    owner_user_id: str | None = None,
) -> None:
    def task() -> None:
        if not _ensure_app():
            return
        from google.cloud.firestore import Increment

        cleaned = [p for p in paths if p][-50:]
        _live_ref(project_id, "files").set(
            {
                "rev": Increment(1),
                "paths": cleaned,
                "updated_at": _utc_now(),
            },
            merge=True,
            retry=None,
            timeout=_RPC_TIMEOUT_S,
        )

    _dispatch("bump_files", task)
