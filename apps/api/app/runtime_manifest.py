"""Closed package manifest for generated apps (AST allowlist).

The package list lives in ``runtime/packages.json`` — the SAME file the browser
import map is generated from (``runtime/importmap.mjs``). This guarantees that a
bare import accepted by the validator is actually resolvable at runtime, which
used to drift and produce IMPORT_NOT_IN_MANIFEST crashes on valid code.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_MANIFEST_PATH = Path(__file__).resolve().parent.parent / "runtime" / "packages.json"


@lru_cache(maxsize=1)
def _manifest() -> dict:
    with _MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def allowed_packages() -> dict[str, str]:
    """package -> caret version pin, for every package in the shared manifest."""
    return {name: f"^{spec['version']}" for name, spec in _manifest()["packages"].items()}


@lru_cache(maxsize=1)
def browser_packages() -> frozenset[str]:
    """Packages resolvable in the browser import map (subset of allowed)."""
    return frozenset(name for name, spec in _manifest()["packages"].items() if spec.get("browser"))


def _cdn_url(name: str, spec: dict, subpath: str = "") -> str:
    manifest = _manifest()
    base = f"{manifest['cdn']}/{name}@{spec['version']}"
    path = f"/{subpath}" if subpath else ""
    react = manifest["reactVersion"]
    query = f"?deps=react@{react},react-dom@{react}" if spec.get("peerReact") else ""
    return f"{base}{path}{query}"


@lru_cache(maxsize=1)
def browser_import_map() -> dict[str, str]:
    """Specifier -> CDN URL, for the preview runner's <script type="importmap">.

    Mirrors `runtime/importmap.mjs`; both read the same packages.json and CI
    asserts they produce byte-identical maps. The runner shell used to carry a
    hand-written copy of this map, which silently drifted: packages accepted by
    the AST validator failed to resolve in the browser.
    """
    out: dict[str, str] = {}
    for name, spec in _manifest()["packages"].items():
        if not spec.get("browser"):
            continue
        out[name] = _cdn_url(name, spec)
        for subpath in spec.get("subpaths", []):
            out[f"{name}/{subpath}"] = _cdn_url(name, spec, subpath)
    return out


def package_version(package: str) -> str | None:
    """Caret pin for a single package, or None if not in the manifest."""
    return allowed_packages().get(package)


def is_relative_or_alias(spec: str) -> bool:
    return spec.startswith(("./", "../", "/", "@/"))


FORBIDDEN_BARE_PREFIXES = (
    "node:",
    "fs",
    "path",
    "child_process",
    "worker_threads",
    "cluster",
    "net",
    "http",
    "https",
    "os",
    "process",
    "vm",
    "module",
)

# Backend SDKs are structurally impossible in a frontend-only prototype: they are
# not in the manifest, and naming them explicitly gives a far better error message
# than a generic "unknown package".
FORBIDDEN_BACKEND_PACKAGES = (
    "firebase",
    "firebase-admin",
    "@supabase/supabase-js",
    "@supabase/auth-helpers-react",
    "stripe",
    "@stripe/stripe-js",
    "resend",
    "nodemailer",
    "cloudinary",
    "aws-sdk",
    "@aws-sdk/client-s3",
    "mongodb",
    "mongoose",
    "pg",
    "mysql2",
    "prisma",
    "@prisma/client",
    "openai",
    "express",
    "next",
)
