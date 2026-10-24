"""Standalone deck player bundle, built by ``runtime/deck/build.mjs``.

One esbuild run per distinct (variant, icon set): the result is kept in a
small in-process cache keyed by the player source too, so a republish or a
second export of the same deck does not rebuild.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import os
import tempfile
from collections import OrderedDict
from pathlib import Path

from app.services.publish_esm import runtime_dir

BUILD_TIMEOUT_S = 90.0
_CACHE_SIZE = 16
_cache: OrderedDict[str, bytes] = OrderedDict()
_lock = asyncio.Lock()


def deck_runtime_dir() -> Path:
    return runtime_dir() / "deck"


def player_source_dir() -> Path | None:
    """Where build.mjs will read the player (same lookup order as the script)."""
    env = os.environ.get("FORGE_DECK_PLAYER_SRC")
    here = deck_runtime_dir()
    for candidate in (
        Path(env) if env else None,
        here / "player-src" / "deck-player",
        here.parents[2] / "web" / "components" / "deck-player",
    ):
        if candidate is not None and (candidate / "index.ts").is_file():
            return candidate
    return None


def _source_signature() -> str:
    digest = hashlib.sha256()
    folders = [player_source_dir(), deck_runtime_dir() / "src"]
    for folder in folders:
        if folder is None or not folder.is_dir():
            continue
        for path in sorted(folder.rglob("*")):
            if path.is_file() and path.suffix in (".ts", ".tsx"):
                stat = path.stat()
                digest.update(f"{path.name}:{stat.st_size}:{stat.st_mtime_ns}".encode())
    return digest.hexdigest()[:16]


class BundleError(RuntimeError):
    pass


async def build_player_bundle(icons: list[str], *, variant: str = "site") -> bytes:
    """Minified IIFE of the player with only ``icons`` from lucide."""
    if variant not in ("site", "export"):
        raise ValueError(variant)
    wanted = sorted({str(i) for i in icons})
    key = hashlib.sha256(json.dumps([variant, wanted, _source_signature()]).encode()).hexdigest()
    async with _lock:
        cached = _cache.get(key)
        if cached is not None:
            _cache.move_to_end(key)
            return cached
        code = await _run_build(wanted, variant)
        _cache[key] = code
        while len(_cache) > _CACHE_SIZE:
            _cache.popitem(last=False)
        return code


async def _run_build(icons: list[str], variant: str) -> bytes:
    script = deck_runtime_dir() / "build.mjs"
    if not script.is_file():
        raise BundleError(f"deck build script missing at {script}")
    with tempfile.TemporaryDirectory(prefix="forge-deck-bundle-") as tmp:
        out = Path(tmp) / "deck.js"
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(script),
            "--out",
            str(out),
            cwd=str(deck_runtime_dir()),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        payload = json.dumps({"icons": icons, "variant": variant}).encode()
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(payload), timeout=BUILD_TIMEOUT_S)
        except TimeoutError as exc:
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
            raise BundleError("deck player build timed out") from exc
        try:
            result = json.loads(stdout.decode("utf-8") or "{}")
        except ValueError:
            result = {}
        if proc.returncode != 0 or not result.get("ok") or not out.is_file():
            detail = result.get("error") or stderr.decode("utf-8", "replace")[-2000:]
            raise BundleError(f"deck player build failed: {detail}")
        return out.read_bytes()
