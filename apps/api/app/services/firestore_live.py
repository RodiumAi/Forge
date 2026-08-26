"""Firestore live mirror for the Forge builder UI (preview, publish, run, files).

Postgres remains the durable source of truth. All helpers are fire-and-forget:
failures are logged and never raise into preview/publish/agent paths.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
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

# Local-only signing material for Auth emulator custom tokens (NOT for production).
_EMULATOR_SA_CANDIDATES = (
    Path("/srv/infra/firebase-admin-emulator.json"),  # Docker mount
    Path(__file__).resolve().parents[3] / "infra" / "local" / "firebase-admin-emulator.json",
    Path("/tmp/firebase-admin-emulator.json"),
)


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
    if not _ensure_app():
        return
    try:
        data: dict[str, Any] = {
            "owner_user_id": str(owner_user_id),
            "updated_at": _utc_now(),
        }
        if name:
            data["name"] = name
        _project_ref(project_id).set(data, merge=True)
    except Exception:
        logger.exception("ensure_project failed project=%s", project_id)


def mirror_dashboard(
    owner_user_id: str,
    project_id: str,
    *,
    name: str | None = None,
    preview_status: str | None = None,
    published_at: str | None = None,
    active_run_status: str | None = None,
) -> None:
    if not owner_user_id or not _ensure_app():
        return
    try:
        patch: dict[str, Any] = {"updated_at": _utc_now()}
        if name is not None:
            patch["name"] = name
        if preview_status is not None:
            patch["preview_status"] = preview_status
        if published_at is not None:
            patch["published_at"] = published_at
        if active_run_status is not None:
            patch["active_run_status"] = active_run_status
        _user_project_ref(str(owner_user_id), project_id).set(patch, merge=True)
    except Exception:
        logger.exception("mirror_dashboard failed project=%s", project_id)


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
    if not _ensure_app():
        return
    try:
        if owner_user_id:
            ensure_project(project_id, owner_user_id, name=name)
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
        _live_ref(project_id, "preview").set(payload, merge=True)
        if owner_user_id:
            mirror_dashboard(
                owner_user_id,
                project_id,
                name=name,
                preview_status=status,
            )
    except Exception:
        logger.exception("set_preview failed project=%s", project_id)


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
    if not _ensure_app():
        return
    try:
        if owner_user_id:
            ensure_project(project_id, owner_user_id, name=name)
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
        _live_ref(project_id, "publish").set(payload, merge=True)
        if owner_user_id and published_at is not None:
            mirror_dashboard(
                owner_user_id,
                project_id,
                name=name,
                published_at=published_at,
            )
    except Exception:
        logger.exception("set_publish failed project=%s", project_id)


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
    if not _ensure_app():
        return
    if throttle:
        now = time.monotonic()
        last = _last_run_write_mono.get(project_id, 0.0)
        if now - last < _RUN_THROTTLE_S and status == "running":
            return
        _last_run_write_mono[project_id] = now
    try:
        if owner_user_id:
            ensure_project(project_id, owner_user_id, name=name)
        payload: dict[str, Any] = {
            "run_id": run_id,
            "status": status,
            "updated_at": _utc_now(),
        }
        if step_id is not None:
            payload["step_id"] = step_id
        if step_label is not None:
            payload["step_label"] = step_label
        _live_ref(project_id, "run").set(payload, merge=True)
        if owner_user_id:
            mirror_dashboard(
                owner_user_id,
                project_id,
                name=name,
                active_run_status=status,
            )
    except Exception:
        logger.exception("set_run failed project=%s", project_id)


def bump_files(
    project_id: str,
    paths: list[str],
    *,
    owner_user_id: str | None = None,
) -> None:
    if not _ensure_app():
        return
    try:
        from google.cloud.firestore import Increment

        if owner_user_id:
            ensure_project(project_id, owner_user_id)
        cleaned = [p for p in paths if p][-50:]
        ref = _live_ref(project_id, "files")
        ref.set(
            {
                "rev": Increment(1),
                "paths": cleaned,
                "updated_at": _utc_now(),
            },
            merge=True,
        )
    except Exception:
        logger.exception("bump_files failed project=%s", project_id)
