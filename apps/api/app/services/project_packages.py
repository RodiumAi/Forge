"""Per-project npm dependencies — dynamic import map, zero install.

The agent (or the user) declares dependencies in the project's package.json;
they become importable immediately: the runner shell and the published site
extend the base import map with esm.sh URLs, and the AST validator accepts
the declared names. No npm install, no bundler, no per-project process —
the CDN bundles on the fly, which is the whole point of the Babel runner.

Base manifest pins always win: a project cannot downgrade react or shadow a
curated package. Backend SDKs and node built-ins stay forbidden regardless
of what package.json claims.
"""

from __future__ import annotations

import json
import re

from app.runtime_manifest import (
    FORBIDDEN_BACKEND_PACKAGES,
    FORBIDDEN_BARE_PREFIXES,
    _manifest,
    allowed_packages,
)
from app.services.filesystem import read_file

# npm package name (scoped or not), conservative.
_NAME_RE = re.compile(r"^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$")
# Semver-ish range specs only — anything else (git URLs, file:, workspace:) is
# not resolvable by the CDN and gets dropped.
_VERSION_RE = re.compile(r"^[\^~]?\d[\w.^~<>=*+-]*$|^latest$|^\*$")

MAX_PROJECT_PACKAGES = 40


def _forbidden(name: str) -> bool:
    if name in FORBIDDEN_BACKEND_PACKAGES:
        return True
    return any(name == p or name.startswith(p + "/") for p in FORBIDDEN_BARE_PREFIXES)


def project_dependencies(project_id: str) -> dict[str, str]:
    """Sanitized name -> version spec from the project's package.json.

    Packages already pinned by the base manifest are excluded (base wins).
    """
    try:
        raw = json.loads(read_file(project_id, "package.json"))
    except Exception:
        return {}
    deps = raw.get("dependencies")
    if not isinstance(deps, dict):
        return {}
    base = allowed_packages()
    out: dict[str, str] = {}
    for name, spec in deps.items():
        if len(out) >= MAX_PROJECT_PACKAGES:
            break
        if not isinstance(name, str) or not isinstance(spec, str):
            continue
        name = name.strip()
        spec = spec.strip() or "latest"
        if not _NAME_RE.match(name) or name in base or _forbidden(name):
            continue
        if not _VERSION_RE.match(spec):
            continue
        out[name] = spec
    return out


def extra_import_map(project_id: str) -> dict[str, str]:
    """Import-map entries for the project's own dependencies (esm.sh).

    Two entries per package: the exact specifier (with react deps pinned so the
    CDN never ships a second React), and a trailing-slash prefix so subpath
    imports (`react-icons/fa`, `date-fns/locale`) resolve generically.
    """
    deps = project_dependencies(project_id)
    if not deps:
        return {}
    manifest = _manifest()
    cdn = manifest["cdn"]
    react = manifest["reactVersion"]
    out: dict[str, str] = {}
    for name, spec in deps.items():
        version = "" if spec in ("latest", "*") else f"@{spec}"
        out[name] = f"{cdn}/{name}{version}?deps=react@{react},react-dom@{react}"
        out[f"{name}/"] = f"{cdn}/{name}{version}/"
    return out


def project_allowed_packages(project_id: str) -> dict[str, str]:
    """Base manifest allowlist extended with the project's declared deps."""
    return {**allowed_packages(), **project_dependencies(project_id)}


def sanitize_batch_dependencies(package_json_content: str) -> dict[str, str]:
    """Deps declared by a package.json arriving in the CURRENT write batch.

    The agent adds the dependency and imports it in the same turn; validating
    the imports against disk only would reject the batch that introduces both.
    """
    try:
        raw = json.loads(package_json_content)
    except Exception:
        return {}
    deps = raw.get("dependencies")
    if not isinstance(deps, dict):
        return {}
    base = allowed_packages()
    out: dict[str, str] = {}
    for name, spec in deps.items():
        if len(out) >= MAX_PROJECT_PACKAGES:
            break
        if not isinstance(name, str) or not isinstance(spec, str):
            continue
        name = name.strip()
        if not _NAME_RE.match(name) or name in base or _forbidden(name):
            continue
        if not _VERSION_RE.match(spec.strip() or "latest"):
            continue
        out[name] = spec.strip() or "latest"
    return out
