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
    return {
        name: f"^{spec['version']}"
        for name, spec in _manifest()["packages"].items()
    }


@lru_cache(maxsize=1)
def browser_packages() -> frozenset[str]:
    """Packages resolvable in the browser import map (subset of allowed)."""
    return frozenset(
        name for name, spec in _manifest()["packages"].items() if spec.get("browser")
    )


def package_version(package: str) -> str | None:
    """Caret pin for a single package, or None if not in the manifest."""
    return allowed_packages().get(package)


def is_relative_or_alias(spec: str) -> bool:
    return (
        spec.startswith("./")
        or spec.startswith("../")
        or spec.startswith("/")
        or spec.startswith("@/")
    )


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
