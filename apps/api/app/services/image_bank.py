"""Free image bank (Pixabay) behind the image panel's "Libres" tab.

Pixabay terms (https://pixabay.com/api/docs/) shape this module:

* results are cached 24 hours, which also keeps us under the 100 requests per
  minute the key allows (counted here too, so a burst is refused politely
  instead of getting the key throttled);
* search results may be shown from Pixabay URLs, but an image the user keeps
  is downloaded into the project (``public/images/``) and never hotlinked;
* the key stays on the server: the browser only sees normalized hits.

Valkey holds the cache and the rate counter; without it an in-process store
takes over, like the auth rate limiter does.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

import httpx

from app.config import get_settings
from app.errors import SitesError

logger = logging.getLogger(__name__)

PIXABAY_API_URL = "https://pixabay.com/api/"
CACHE_TTL_SECONDS = 24 * 3600
RATE_LIMIT_PER_MINUTE = 100
PER_PAGE = 24
MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
_PREFIX = "forge:imgbank:"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
_DOWNLOAD_HOSTS = ("pixabay.com", "cdn.pixabay.com")
# Languages the Pixabay search understands; anything else searches in English.
PIXABAY_LANGS = frozenset(
    [
        "cs",
        "da",
        "de",
        "en",
        "es",
        "fr",
        "id",
        "it",
        "hu",
        "nl",
        "no",
        "pl",
        "pt",
        "ro",
        "sk",
        "fi",
        "sv",
        "tr",
        "vi",
        "th",
        "bg",
        "ru",
        "el",
        "ja",
        "ko",
        "zh",
    ]
)

ImageType = Literal["photo", "illustration", "vector"]
Orientation = Literal["all", "horizontal", "vertical"]

_KEY_PARAM_RE = re.compile(r"([?&]key=)[^&\s\"']+")


def _is_pixabay_url(value: str) -> bool:
    host = (urlparse(value).hostname or "").lower()
    return host == "pixabay.com" or host.endswith(".pixabay.com")


class _RedactPixabayKey(logging.Filter):
    """httpx logs every request URL at INFO, and Pixabay wants the key in it."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and any(_is_pixabay_url(str(arg)) for arg in record.args):
            record.args = tuple(_KEY_PARAM_RE.sub(r"\1***", str(arg)) for arg in record.args)
        return True


logging.getLogger("httpx").addFilter(_RedactPixabayKey())

_local_cache: dict[str, tuple[float, str]] = {}
_local_hits: dict[str, tuple[int, float]] = {}
_local_lock = threading.Lock()


@dataclass(frozen=True)
class StockImage:
    id: str
    previewUrl: str
    width: int
    height: int
    author: str
    pageUrl: str
    tags: str
    source: str = "pixabay"


def is_configured() -> bool:
    return bool(get_settings().pixabay_api_key.strip())


def _redis():
    import redis  # lazy: the fallback must work without the server

    return redis.Redis.from_url(get_settings().redis_url)


def _cache_get(key: str) -> str | None:
    try:
        value = _redis().get(_PREFIX + key)
        return value.decode("utf-8") if value is not None else None
    except Exception:
        pass
    now = time.monotonic()
    with _local_lock:
        hit = _local_cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    return None


def _cache_set(key: str, value: str) -> None:
    try:
        _redis().set(_PREFIX + key, value, ex=CACHE_TTL_SECONDS)
        return
    except Exception:
        pass
    now = time.monotonic()
    with _local_lock:
        if len(_local_cache) > 500:
            for stale, (expires, _) in list(_local_cache.items()):
                if expires <= now:
                    _local_cache.pop(stale, None)
            while len(_local_cache) > 500:
                _local_cache.pop(next(iter(_local_cache)))
        _local_cache[key] = (now + CACHE_TTL_SECONDS, value)


def _take_rate_slot() -> None:
    """Count one call against the key's 100 per minute, across workers."""
    window = int(time.time() // 60)
    key = f"{_PREFIX}rl:{window}"
    hits: int | None = None
    try:
        client = _redis()
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, 70, nx=True)
        hits = int(pipe.execute()[0])
    except Exception:
        now = time.monotonic()
        with _local_lock:
            count, expires = _local_hits.get(key, (0, now + 70))
            hits = count + 1
            _local_hits[key] = (hits, expires)
            for stale, (_, stale_expiry) in list(_local_hits.items()):
                if stale_expiry <= now:
                    _local_hits.pop(stale, None)
    if hits > RATE_LIMIT_PER_MINUTE:
        raise SitesError(429, "IMAGE_SEARCH_BUSY", "Too many image searches right now. Retry in a minute.")


def _call_pixabay(params: dict[str, Any]) -> dict[str, Any]:
    """One cached Pixabay API call. The key is added here and never cached."""
    settings = get_settings()
    api_key = settings.pixabay_api_key.strip()
    if not api_key:
        raise SitesError(503, "IMAGE_SEARCH_UNAVAILABLE", "The free image search is not configured.")
    cache_key = "q:" + hashlib.sha256(json.dumps(params, sort_keys=True).encode("utf-8")).hexdigest()
    cached = _cache_get(cache_key)
    if cached is not None:
        return json.loads(cached)
    _take_rate_slot()
    try:
        response = httpx.get(PIXABAY_API_URL, params={"key": api_key, **params}, timeout=_TIMEOUT)
    except httpx.HTTPError as exc:
        logger.warning("pixabay request failed: %s", type(exc).__name__)
        raise SitesError(502, "IMAGE_SEARCH_FAILED", "The image bank did not answer.") from exc
    if response.status_code == 429:
        raise SitesError(429, "IMAGE_SEARCH_BUSY", "Too many image searches right now. Retry in a minute.")
    if response.status_code != 200:
        # Never log the URL: it carries the key.
        logger.warning("pixabay answered %s", response.status_code)
        raise SitesError(502, "IMAGE_SEARCH_FAILED", "The image bank refused the search.")
    try:
        body = response.json()
    except ValueError as exc:
        raise SitesError(502, "IMAGE_SEARCH_FAILED", "The image bank sent an unreadable answer.") from exc
    if not isinstance(body, dict):
        raise SitesError(502, "IMAGE_SEARCH_FAILED", "The image bank sent an unreadable answer.")
    _cache_set(cache_key, json.dumps(body))
    return body


def _normalize(hit: dict[str, Any]) -> StockImage | None:
    try:
        return StockImage(
            id=str(int(hit["id"])),
            previewUrl=str(hit.get("webformatURL") or hit.get("previewURL") or ""),
            width=int(hit.get("imageWidth") or 0),
            height=int(hit.get("imageHeight") or 0),
            author=str(hit.get("user") or ""),
            pageUrl=str(hit.get("pageURL") or ""),
            tags=str(hit.get("tags") or ""),
        )
    except (KeyError, TypeError, ValueError):
        return None


def search(
    query: str,
    *,
    image_type: ImageType = "photo",
    orientation: Orientation = "all",
    lang: str = "en",
    page: int = 1,
) -> dict[str, Any]:
    lang = lang.lower()[:2]
    params = {
        "q": query.strip()[:100],
        "image_type": image_type,
        "orientation": orientation,
        "lang": lang if lang in PIXABAY_LANGS else "en",
        "safesearch": "true",
        "page": max(1, min(page, 20)),
        "per_page": PER_PAGE,
    }
    body = _call_pixabay(params)
    hits = [image for raw in body.get("hits") or [] if isinstance(raw, dict) and (image := _normalize(raw))]
    total = int(body.get("totalHits") or 0)
    return {
        "hits": [vars(image) for image in hits],
        "total": total,
        "page": params["page"],
        "hasMore": params["page"] * PER_PAGE < total,
        "source": "pixabay",
    }


def _allowed_download(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and host in _DOWNLOAD_HOSTS


def fetch_for_import(image_id: str) -> tuple[bytes, StockImage]:
    """The large rendition of one Pixabay image, with its credit."""
    if not image_id.isdigit() or len(image_id) > 20:
        raise SitesError(400, "INVALID_IMAGE_ID", "Invalid image id.")
    body = _call_pixabay({"id": image_id})
    raw_hits = [hit for hit in body.get("hits") or [] if isinstance(hit, dict)]
    if not raw_hits:
        raise SitesError(404, "IMAGE_NOT_FOUND", "This image is no longer available.")
    hit = raw_hits[0]
    meta = _normalize(hit)
    url = str(hit.get("largeImageURL") or hit.get("webformatURL") or "")
    if meta is None or not _allowed_download(url):
        raise SitesError(502, "IMAGE_SEARCH_FAILED", "The image bank sent an unusable image.")
    try:
        with httpx.stream("GET", url, timeout=_TIMEOUT, follow_redirects=False) as response:
            if response.status_code != 200:
                raise SitesError(502, "IMAGE_DOWNLOAD_FAILED", "The image could not be downloaded.")
            if not response.headers.get("content-type", "").startswith("image/"):
                raise SitesError(502, "IMAGE_DOWNLOAD_FAILED", "The image bank did not send an image.")
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_DOWNLOAD_BYTES:
                    raise SitesError(413, "IMAGE_TOO_LARGE", "The image is too large to import.")
                chunks.append(chunk)
    except httpx.HTTPError as exc:
        raise SitesError(502, "IMAGE_DOWNLOAD_FAILED", "The image could not be downloaded.") from exc
    return b"".join(chunks), meta
