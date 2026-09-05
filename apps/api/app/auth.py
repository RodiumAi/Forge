from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
settings = get_settings()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: UUID, token_version: int = 0) -> str:
    """Mint a session JWT.

    `tv` pins the token to the user's current `token_version`. Bumping that
    column (password change or reset) makes every previously-issued token stop
    validating — the only revocation mechanism we have, since these tokens live
    7 days and are not stored anywhere.
    """
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire, "tv": token_version}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def token_for_user(user: User) -> str:
    return create_access_token(user.id, user.token_version or 0)


#: A browser cannot set an Authorization header on `<img src>` or an iframe, so
#: those loads carry their credential in the query string — where it lands in
#: access logs and Referer headers. This token exists so what leaks there is
#: narrow and short-lived instead of a 7-day full-access session.
MEDIA_TOKEN_SCOPE = "media"
MEDIA_TOKEN_TTL_MINUTES = 60


def create_media_token(user_id: UUID, token_version: int = 0) -> str:
    """Mint a read-only, short-lived token for browser-loaded resources.

    Carries `tv` like a session token, so a password change revokes it too.
    """
    expire = datetime.now(UTC) + timedelta(minutes=MEDIA_TOKEN_TTL_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "tv": token_version,
        "scope": MEDIA_TOKEN_SCOPE,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def media_token_for_user(user: User) -> str:
    return create_media_token(user.id, user.token_version or 0)


def _query_token(request: Request) -> str | None:
    for key in ("access_token", "token"):
        value = request.query_params.get(key)
        if value:
            return value.strip() or None
    return None


def _resolve_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    *,
    allow_media_query_token: bool,
) -> User:
    """Shared body of the two auth dependencies.

    `allow_media_query_token` is what separates them. Session tokens are
    header-only everywhere; only the handful of routes a browser loads
    directly accept a credential in the query string, and only a
    media-scoped one.
    """
    locale = resolve_locale(request)

    token = credentials.credentials if credentials and credentials.credentials else None
    from_query = False
    if not token and allow_media_query_token:
        token = _query_token(request)
        from_query = token is not None

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("not_authenticated", locale),
        )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=t("invalid_token", locale),
            )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("invalid_token", locale),
        ) from exc

    scope = payload.get("scope")
    if from_query:
        # A session token pasted into a query string is refused outright: that
        # is the leak this split exists to prevent.
        if scope != MEDIA_TOKEN_SCOPE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=t("invalid_token", locale),
            )
    elif scope is not None:
        # And the reverse: a media token must not stand in for a session on the
        # rest of the API, where it would grant writes it was never meant to.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("invalid_token", locale),
        )

    user = db.get(User, UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("user_not_found", locale),
        )

    # Tokens minted before the last password change are dead. Absent `tv`
    # means a token issued before this claim existed; those are only accepted
    # while the user has never bumped the counter.
    if int(payload.get("tv", 0) or 0) != int(user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("session_revoked", locale),
        )
    return user


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """The default dependency: `Authorization: Bearer` only."""
    return _resolve_user(request, credentials, db, allow_media_query_token=False)


def get_media_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """For the few GET routes a browser loads directly.

    Accepts a normal bearer session (programmatic callers, tests) or a
    media-scoped `?access_token=`. Use it only on read-only routes: the query
    string is the one place a credential is routinely copied into logs.
    """
    return _resolve_user(request, credentials, db, allow_media_query_token=True)
